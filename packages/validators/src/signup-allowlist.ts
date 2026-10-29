import { z } from "@hono/zod-openapi";
import {
  normalizeSignupEmail,
  signupEmailMaximumLength,
  userRoles,
} from "@openmonetis/domain/signup-allowlist";

export const UserRoleSchema = z.enum(userRoles).openapi("UserRole");

export const CreateSignupAllowlistEntryInputSchema = z
  .object({
    email: z.email().max(signupEmailMaximumLength).transform(normalizeSignupEmail),
    role: UserRoleSchema.default("member"),
  })
  .strict()
  .openapi("CreateSignupAllowlistEntryInput");

export const SignupAllowlistEntryParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("SignupAllowlistEntryParams");

export const SignupAllowlistEntryOutputSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    role: UserRoleSchema,
    registered: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .openapi("SignupAllowlistEntry");

export type UserRole = z.infer<typeof UserRoleSchema>;
export type CreateSignupAllowlistEntryInput = z.infer<typeof CreateSignupAllowlistEntryInputSchema>;
export type SignupAllowlistEntryOutput = z.infer<typeof SignupAllowlistEntryOutputSchema>;
