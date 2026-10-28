import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  FinancialDistributionOutputSchema,
  ListFinancialDistributionQuerySchema,
} from "@openmonetis/validators/financial-distribution";
import type { FinancialDistributionService } from "../services/financial-distribution.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const FinancialDistributionResponseSchema = z.object({
  data: FinancialDistributionOutputSchema,
  error: z.null(),
});

export function createFinancialDistributionRoute(service: FinancialDistributionService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Reports"],
      request: { query: ListFinancialDistributionQuerySchema },
      responses: {
        200: {
          description: "Monthly financial distribution by category",
          content: { "application/json": { schema: FinancialDistributionResponseSchema } },
        },
        400: {
          description: "Invalid report period or person filter",
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
