import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  RecurringTransactionsReportOutputSchema,
  RecurringTransactionsReportQuerySchema,
} from "@openmonetis/validators/recurring-transactions";
import type { RecurringTransactionsService } from "../services/recurring-transactions.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema, validationHook } from "../utils/openapi";

export function createRecurringTransactionsRoute(service: RecurringTransactionsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/report",
      tags: ["Reports"],
      request: { query: RecurringTransactionsReportQuerySchema },
      responses: {
        200: {
          description:
            "Recurring income or expenses, grouped by series, with monthly occurrence projections",
          content: {
            "application/json": {
              schema: z.object({ data: RecurringTransactionsReportOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid report filters",
          content: { "application/json": { schema: ErrorResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorResponseSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.report(context.req.valid("query"), context.get("userId"))),
        200,
      ),
  );
  return route;
}
