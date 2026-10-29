import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ApiKeyOutputSchema,
  ApiKeyParamsSchema,
  CreateApiKeyInputSchema,
  CreatedApiKeyOutputSchema,
} from "@openmonetis/validators/api-keys";
import type { ApiKeysService } from "../services/api-keys.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

const errorResponses = {
  400: { description: "Invalid request", content: { "application/json": { schema: errorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: errorSchema } },
  },
  403: {
    description: "API keys cannot manage API keys",
    content: { "application/json": { schema: errorSchema } },
  },
  404: {
    description: "API key not found",
    content: { "application/json": { schema: errorSchema } },
  },
} as const;

export function createApiKeysRoute(service: ApiKeysService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["API keys"],
      responses: {
        200: {
          description: "Active API keys",
          content: {
            "application/json": {
              schema: z.object({ data: z.array(ApiKeyOutputSchema), error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["API keys"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateApiKeyInputSchema } },
        },
      },
      responses: {
        201: {
          description: "API key created; the secret is returned only once",
          content: {
            "application/json": {
              schema: z.object({ data: CreatedApiKeyOutputSchema, error: z.null() }),
            },
          },
        },
        409: {
          description: "Active API key limit reached",
          content: { "application/json": { schema: errorSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["API keys"],
      request: { params: ApiKeyParamsSchema },
      responses: {
        200: {
          description: "API key revoked",
          content: {
            "application/json": {
              schema: z.object({ data: z.object({ id: z.uuid() }), error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.revoke(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  return route;
}
