import { z } from "@hono/zod-openapi";
import { apiKeyLifetimeOptions, apiKeyNameMaximumLength } from "@openmonetis/domain/api-keys";

export const CreateApiKeyInputSchema = z
  .object({
    name: z.string().trim().min(1).max(apiKeyNameMaximumLength),
    expiresInDays: z
      .literal(apiKeyLifetimeOptions)
      .nullable()
      .openapi({ description: "Key lifetime in days; null keeps the key valid until revoked." }),
  })
  .strict()
  .openapi("CreateApiKeyInput");

export const ApiKeyParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("ApiKeyParams");

export const ApiKeyOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    keyPrefix: z.string(),
    lastUsedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("ApiKey");

export const CreatedApiKeyOutputSchema = ApiKeyOutputSchema.extend({
  key: z.string(),
}).openapi("CreatedApiKey");

export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInputSchema>;
export type ApiKeyOutput = z.infer<typeof ApiKeyOutputSchema>;
export type CreatedApiKeyOutput = z.infer<typeof CreatedApiKeyOutputSchema>;
