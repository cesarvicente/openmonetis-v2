import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import { AuthConfigOutputSchema } from "@openmonetis/validators/auth-config";
import type { AuthConfigService } from "../services/auth-config.service";
import { validationHook } from "../utils/openapi";

export function createAuthConfigRoute(service: AuthConfigService) {
  const route = new OpenAPIHono({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Authentication"],
      security: [],
      responses: {
        200: {
          description: "Public authentication capabilities; contains no credentials",
          content: {
            "application/json": {
              schema: z.object({ data: AuthConfigOutputSchema, error: z.null() }),
            },
          },
        },
      },
    }),
    (context) => {
      context.header("Cache-Control", "no-store");
      return context.json(ok(service.get()), 200);
    },
  );
  return route;
}
