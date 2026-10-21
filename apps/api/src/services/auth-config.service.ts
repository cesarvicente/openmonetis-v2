import type { AuthConfigOutput } from "@openmonetis/validators/auth-config";

export function createAuthConfigService(configuration: Readonly<AuthConfigOutput>) {
  return {
    get(): AuthConfigOutput {
      return {
        signupEnabled: configuration.signupEnabled,
        googleEnabled: configuration.googleEnabled,
      };
    },
  };
}

export type AuthConfigService = ReturnType<typeof createAuthConfigService>;
