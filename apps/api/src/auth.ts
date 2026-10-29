import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { db } from "@openmonetis/db";
import * as schema from "@openmonetis/db/schema";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, freshSessionMiddleware } from "better-auth/api";
import type { GoogleProfile } from "better-auth/social-providers";
import { enforcePasswordChangePolicy } from "./middlewares/password-change";
import { categoriesRepository } from "./repositories/categories.repository";
import { peopleRepository } from "./repositories/people.repository";
import { signupAllowlistRepository } from "./repositories/signup-allowlist.repository";
import { createCategoriesService } from "./services/categories.service";
import { createPeopleService } from "./services/people.service";
import { createSignupAllowlistService } from "./services/signup-allowlist.service";
import { createPasswordResetEmail, createVerificationEmail } from "./utils/auth-emails";
import { type EmailMessage, emailSender } from "./utils/email";
import {
  assertProductionSecret,
  getRequiredProductionEnv,
  parseBooleanEnv,
  parseCsvEnv,
  parsePositiveIntegerEnv,
} from "./utils/env";

const DEFAULT_SESSION_EXPIRES_IN_DAYS = 30;
const DEFAULT_SESSION_UPDATE_AGE_HOURS = 24;
const EMAIL_VERIFICATION_EXPIRES_IN_SECONDS = 24 * 60 * 60;
const PASSWORD_RESET_EXPIRES_IN_SECONDS = 60 * 60;
// Set only by the web proxy from a trusted reverse-proxy header; clients cannot spoof it.
export const CLIENT_IP_HEADER = "x-openmonetis-client-ip";
const SIGNUP_POLICIES = ["allowlist", "open"] as const;
type SignupPolicy = (typeof SIGNUP_POLICIES)[number];
const PASSKEY_FRESH_SESSION_AGE_SECONDS = 10 * 60;
const PASSKEY_SENSITIVE_MANAGEMENT_PATHS = new Set([
  "/passkey/update-passkey",
  "/passkey/delete-passkey",
]);
const DEVELOPMENT_AUTH_SECRET = "openmonetis-local-development-secret-change-me";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const disableSignup = parseBooleanEnv("DISABLE_SIGNUP");
const signupPolicy = parseSignupPolicy(process.env.SIGNUP_POLICY);
const requireEmailVerification = parseBooleanEnv("REQUIRE_EMAIL_VERIFICATION", true);
export const authConfiguration = {
  signupEnabled: !disableSignup,
  googleEnabled: Boolean(googleClientId && googleClientSecret),
};

if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
  throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");
}

if (!googleClientId && process.env.NODE_ENV === "development") {
  console.warn(
    "[Auth] Google OAuth is disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.",
  );
}

function parseSignupPolicy(value: string | undefined): SignupPolicy {
  const policy = value?.trim().toLowerCase() || "allowlist";
  if (!SIGNUP_POLICIES.includes(policy as SignupPolicy)) {
    throw new Error("SIGNUP_POLICY must be allowlist or open");
  }
  return policy as SignupPolicy;
}

function getGoogleProfileName(profile: GoogleProfile) {
  const fullName = profile.name?.trim();
  if (fullName) return fullName;

  const givenAndFamilyName = [profile.given_name, profile.family_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (givenAndFamilyName) return givenAndFamilyName;

  const emailName = profile.email
    ?.split("@", 1)[0]
    ?.replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return emailName || "Usuário";
}

function getGoogleAvatarFromIdToken(idToken: string | null | undefined) {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      picture?: unknown;
    };
    if (typeof claims.picture !== "string") return null;

    const url = new URL(claims.picture);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getPasskeyOriginConfiguration(url: string) {
  const configuredURL = url.trim();
  const origin = new URL(configuredURL);
  const configuredOrigin = configuredURL.endsWith("/") ? configuredURL.slice(0, -1) : configuredURL;
  const isLocalhostOrigin =
    origin.hostname === "localhost" || origin.hostname.endsWith(".localhost");

  if (origin.origin !== configuredOrigin) {
    throw new Error("WEB_URL must contain only the web origin");
  }

  if (origin.protocol !== "https:" && !isLocalhostOrigin) {
    throw new Error("WEB_URL must use HTTPS for passkey authentication");
  }

  return { origin: origin.origin, rpID: origin.hostname };
}

const baseURL = getRequiredProductionEnv("BETTER_AUTH_URL", "http://localhost:7001");
const passkeyOrigin = getPasskeyOriginConfiguration(
  getRequiredProductionEnv("WEB_URL", "http://localhost:7002"),
);
const webURL = passkeyOrigin.origin;
const trustedOrigins = [webURL, ...parseCsvEnv(process.env.BETTER_AUTH_TRUSTED_ORIGINS)];
const authSecret =
  assertProductionSecret("BETTER_AUTH_SECRET", [
    "change-me",
    "change-me-in-production",
    DEVELOPMENT_AUTH_SECRET,
  ]) ?? DEVELOPMENT_AUTH_SECRET;

const sessionExpiresInDays = parsePositiveIntegerEnv(
  "AUTH_SESSION_EXPIRES_IN_DAYS",
  DEFAULT_SESSION_EXPIRES_IN_DAYS,
);
const sessionUpdateAgeHours = parsePositiveIntegerEnv(
  "AUTH_SESSION_UPDATE_AGE_HOURS",
  DEFAULT_SESSION_UPDATE_AGE_HOURS,
);
const categoriesService = createCategoriesService(categoriesRepository);
const peopleService = createPeopleService(peopleRepository);
const signupAllowlistService = createSignupAllowlistService(signupAllowlistRepository);

// Fire-and-forget keeps response timing independent of the email provider.
function deliverAuthEmail(message: EmailMessage) {
  void emailSender.send(message).catch((error) => {
    console.error("[Auth] Failed to send an authentication email", error);
  });
}

function getRequestedSignupEmail(body: unknown) {
  if (!body || typeof body !== "object" || !("email" in body)) return null;
  return typeof body.email === "string" ? body.email : null;
}

function requireVerifiedPasskeyUser(userVerified: boolean) {
  if (!userVerified) {
    throw new Error("Passkey ceremony did not verify the user");
  }
}

async function syncGoogleProviderAvatar(account: {
  idToken?: string | null;
  providerId: string;
  userId: string;
}) {
  if (account.providerId !== "google") return;

  const providerAvatarUrl = getGoogleAvatarFromIdToken(account.idToken);
  if (!providerAvatarUrl) return;

  try {
    await peopleService.syncAdminProviderAvatar(account.userId, providerAvatarUrl);
  } catch (error) {
    console.error("[Auth] Failed to persist the Google profile avatar", error);
  }
}

export function createAuth(
  options: {
    disableSignup?: boolean;
    signupPolicy?: SignupPolicy;
    requireEmailVerification?: boolean;
  } = {},
) {
  const signupDisabled = options.disableSignup ?? disableSignup;
  const activeSignupPolicy = options.signupPolicy ?? signupPolicy;
  const emailVerificationRequired = options.requireEmailVerification ?? requireEmailVerification;
  function assertSignupAllowed() {
    if (signupDisabled)
      throw new APIError("FORBIDDEN", {
        code: "SIGNUP_DISABLED",
        message: "Sign up is disabled on this instance",
      });
  }
  // Resolves before any write, so rejected signups leave no data behind.
  async function resolveAllowedSignupRole(email: string | null) {
    const role = email ? await signupAllowlistService.resolveSignupRole(email) : null;
    if (activeSignupPolicy === "allowlist" && !role)
      throw new APIError("FORBIDDEN", {
        code: "SIGNUP_NOT_ALLOWED",
        message: "This email is not allowed to sign up",
      });
    return role ?? "member";
  }
  return betterAuth({
    appName: "OpenMonetis",
    baseURL,
    trustedOrigins,
    secret: authSecret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "member", input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: signupDisabled,
      requireEmailVerification: emailVerificationRequired,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_IN_SECONDS,
      sendResetPassword: async ({ user, url }) => {
        deliverAuthEmail(createPasswordResetEmail({ email: user.email, name: user.name, url }));
      },
    },
    emailVerification: {
      sendOnSignUp: emailVerificationRequired,
      sendOnSignIn: emailVerificationRequired,
      autoSignInAfterVerification: true,
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        deliverAuthEmail(createVerificationEmail({ email: user.email, name: user.name, url }));
      },
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              disableSignUp: signupDisabled,
              mapProfileToUser: (profile) => ({
                name: getGoogleProfileName(profile),
                email: profile.email,
                image: profile.picture,
                emailVerified: profile.email_verified,
              }),
            },
          }
        : undefined,
    rateLimit: {
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-in/social": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/change-password": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
        "/verify-email": { window: 60, max: 10 },
        "/passkey/generate-authenticate-options": { window: 60, max: 10 },
        "/passkey/verify-authentication": { window: 60, max: 5 },
        "/passkey/generate-register-options": { window: 60, max: 5 },
        "/passkey/verify-registration": { window: 60, max: 5 },
        "/passkey/update-passkey": { window: 60, max: 5 },
        "/passkey/delete-passkey": { window: 60, max: 5 },
      },
    },
    session: {
      expiresIn: sessionExpiresInDays * 24 * 60 * 60,
      freshAge: PASSKEY_FRESH_SESSION_AGE_SECONDS,
      updateAge: sessionUpdateAgeHours * 60 * 60,
    },
    plugins: [
      passkey({
        rpID: passkeyOrigin.rpID,
        rpName: "OpenMonetis",
        origin: passkeyOrigin.origin,
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        registration: {
          requireSession: true,
          afterVerification: ({ verification }) => {
            requireVerifiedPasskeyUser(verification.registrationInfo?.userVerified === true);
          },
        },
        authentication: {
          afterVerification: ({ verification }) => {
            requireVerifiedPasskeyUser(verification.authenticationInfo.userVerified);
          },
        },
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path.startsWith("/sign-up/")) {
          assertSignupAllowed();
          await resolveAllowedSignupRole(getRequestedSignupEmail(context.body));
        }
        const passwordChangePolicy = enforcePasswordChangePolicy(context);
        if (passwordChangePolicy) return passwordChangePolicy;

        if (PASSKEY_SENSITIVE_MANAGEMENT_PATHS.has(context.path)) {
          await freshSessionMiddleware(context);
        }
      }),
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(baseURL).protocol === "https:",
      },
      database: {
        generateId: "uuid",
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            assertSignupAllowed();
            const role = await resolveAllowedSignupRole(user.email);
            return { data: { ...user, role } };
          },
          after: async (user) => {
            try {
              await peopleService.ensureAdmin({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                providerAvatarUrl: user.image,
              });
              await categoriesService.seedDefaults(user.id);
            } catch (error) {
              console.error("[Auth] Failed to provision default user data", error);
            }
          },
        },
      },
      account: {
        create: { after: syncGoogleProviderAvatar },
        update: { after: syncGoogleProviderAvatar },
      },
    },
  });
}

export const auth = createAuth();
