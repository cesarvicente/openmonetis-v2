import { z } from "@hono/zod-openapi";
import { maximumTransactionTags, normalizeTagName } from "@openmonetis/domain/tags";

export const TagIdsSchema = z
  .array(z.uuid())
  .max(maximumTransactionTags)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate tags are not allowed");
export const CreateTagInputSchema = z
  .object({ name: z.string().transform(normalizeTagName).pipe(z.string().min(1).max(80)) })
  .strict()
  .openapi("CreateTagInput");
export const UpdateTagInputSchema = z
  .object({ name: CreateTagInputSchema.shape.name })
  .strict()
  .openapi("UpdateTagInput");
export const TagParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});
export const TagOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TagOutput");
export const TagsReportQuerySchema = z.object({
  period: z
    .string()
    .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/)
    .openapi({ param: { name: "period", in: "query" } }),
});
export const TagsReportOutputSchema = z
  .object({
    period: z.string(),
    items: z.array(
      z.object({
        tagId: z.uuid(),
        income: z.number(),
        expenses: z.number(),
        transfers: z.number().nonnegative().openapi({
          description:
            "Total transferred between accounts, counting each outgoing posting once without affecting balance",
        }),
        balance: z.number(),
      }),
    ),
  })
  .openapi("TagsReport");
export type CreateTagInput = z.infer<typeof CreateTagInputSchema>;
export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>;
export type TagOutput = z.infer<typeof TagOutputSchema>;
export type TagsReportOutput = z.infer<typeof TagsReportOutputSchema>;
