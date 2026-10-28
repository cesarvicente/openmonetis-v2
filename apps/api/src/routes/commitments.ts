import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CommitmentsOutputSchema,
  ListCommitmentsQuerySchema,
} from "@openmonetis/validators/commitments";
import type { CommitmentsService } from "../services/commitments.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const CommitmentsResponseSchema = z.object({
  data: CommitmentsOutputSchema,
  error: z.null(),
});

export function createCommitmentsRoute(service: CommitmentsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Reports"],
      request: { query: ListCommitmentsQuerySchema },
      responses: {
        200: {
          description: "Monthly commitments from installments, recurring series and launched bills",
          content: { "application/json": { schema: CommitmentsResponseSchema } },
        },
        400: {
          description: "Invalid report period range",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.list(context.get("userId"), context.req.valid("query"))), 200),
  );

  return route;
}
