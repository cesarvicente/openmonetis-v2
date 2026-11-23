import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ReimbursementsQuerySchema,
  ReimbursementsSummaryOutputSchema,
} from "@openmonetis/validators/reimbursements";
import type { ReimbursementsService } from "../services/reimbursements.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

export function createReimbursementsRoute(service: ReimbursementsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Reimbursements"],
      request: { query: ReimbursementsQuerySchema },
      responses: {
        200: {
          description: "Summarize what each person owes and paid back",
          content: {
            "application/json": {
              schema: z.object({ data: ReimbursementsSummaryOutputSchema, error: z.null() }),
            },
          },
        },
        401: error("Authentication required"),
      },
    }),
    async (c) =>
      c.json(ok(await service.summarize(c.get("userId"), c.req.valid("query").period)), 200),
  );

  return route;
}
