import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateSignupAllowlistEntryInputSchema,
  SignupAllowlistEntryOutputSchema,
  SignupAllowlistEntryParamsSchema,
} from "@openmonetis/validators/signup-allowlist";
import type { SignupAllowlistService } from "../services/signup-allowlist.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

const errorResponses = {
  400: { description: "Invalid request", content: { "application/json": { schema: errorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: errorSchema } },
  },
  403: {
    description: "Administrator access required",
    content: { "application/json": { schema: errorSchema } },
  },
} as const;

export function createSignupAllowlistRoute(service: SignupAllowlistService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Emails allowed to sign up",
          content: {
            "application/json": {
              schema: z.object({
                data: z.array(SignupAllowlistEntryOutputSchema),
                error: z.null(),
              }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) => context.json(ok(await service.list()), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Admin"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateSignupAllowlistEntryInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Email allowed to sign up",
          content: {
            "application/json": {
              schema: z.object({ data: SignupAllowlistEntryOutputSchema, error: z.null() }),
            },
          },
        },
        409: {
          description: "Email already allowed",
          content: { "application/json": { schema: errorSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => context.json(ok(await service.create(context.req.valid("json"))), 201),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Admin"],
      request: { params: SignupAllowlistEntryParamsSchema },
      responses: {
        200: {
          description: "Email removed from the signup allowlist",
          content: {
            "application/json": {
              schema: z.object({ data: z.object({ id: z.uuid() }), error: z.null() }),
            },
          },
        },
        404: {
          description: "Entry not found",
          content: { "application/json": { schema: errorSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => context.json(ok(await service.remove(context.req.valid("param").id)), 200),
  );

  return route;
}
