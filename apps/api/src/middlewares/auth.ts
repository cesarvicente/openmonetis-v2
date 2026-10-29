import { fail } from "@openmonetis/shared/api";
import { createMiddleware } from "hono/factory";
import type { ApiKeysService } from "../services/api-keys.service";
import type { ApiVariables } from "../types/context";
import { extractBearerToken } from "../utils/bearer-token";
import { getSession } from "../utils/session";

// Accepts the web session cookie or, when an Authorization header is present, only an API key.
// API keys never fall back to the cookie and always act as a member of their own account.
export function createRequireAuth(apiKeys: Pick<ApiKeysService, "authenticate">) {
  return createMiddleware<{ Variables: ApiVariables }>(async (context, next) => {
    const authorization = context.req.header("Authorization");

    if (authorization !== undefined) {
      const principal = await apiKeys.authenticate(extractBearerToken(authorization));
      if (!principal) {
        return context.json(fail("Invalid or expired API key", "invalid_api_key"), 401);
      }

      context.set("userId", principal.userId);
      context.set("userRole", "member");
      context.set("authMethod", "apiKey");
      context.set("apiKeyId", principal.keyId);
      await next();
      return;
    }

    const session = await getSession(context.req.raw.headers);

    if (!session) {
      return context.json(fail("Authentication required", "unauthorized"), 401);
    }

    context.set("userId", session.user.id);
    context.set("userRole", session.user.role === "admin" ? "admin" : "member");
    context.set("authMethod", "session");
    await next();
  });
}

// Runs after requireAuth on routes that manage credentials, account data or the installation.
export const requireSession = createMiddleware<{ Variables: ApiVariables }>(
  async (context, next) => {
    if (context.get("authMethod") !== "session") {
      return context.json(
        fail("A web session is required for this action", "session_required"),
        403,
      );
    }

    await next();
  },
);
