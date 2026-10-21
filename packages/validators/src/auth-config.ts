import { z } from "@hono/zod-openapi";

export const AuthConfigOutputSchema = z
  .object({
    signupEnabled: z.boolean(),
    googleEnabled: z.boolean(),
  })
  .openapi("AuthConfig");

export type AuthConfigOutput = z.infer<typeof AuthConfigOutputSchema>;
