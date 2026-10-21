import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  DueDateRuleHolidaysQuerySchema,
  DueDateRuleHolidaysSchema,
  DueDateRuleOptionsSchema,
  DueDateRulesOutputSchema,
  DueDateRulesPreviewSchema,
  SaveDueDateRulesInputSchema,
  SetDueDateExceptionInputSchema,
} from "@openmonetis/validators/due-date-rules";
import type { DueDateRulesService } from "../services/due-date-rules.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema, validationHook } from "../utils/openapi";
export function createDueDateRulesRoute(service: DueDateRulesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  const response = (schema: z.ZodType) => ({
    description: "Due date rules",
    content: { "application/json": { schema: z.object({ data: schema, error: z.null() }) } },
  });
  const errors = {
    400: {
      description: "Invalid rules",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Rules changed",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  };
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Due date rules"],
      responses: { 200: response(DueDateRulesOutputSchema), ...errors },
    }),
    async (c) => c.json(ok(await service.get(c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/options",
      tags: ["Due date rules"],
      responses: { 200: response(DueDateRuleOptionsSchema), ...errors },
    }),
    async (c) => c.json(ok(await service.options(c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/holidays",
      tags: ["Due date rules"],
      request: { query: DueDateRuleHolidaysQuerySchema },
      responses: { 200: response(DueDateRuleHolidaysSchema), ...errors },
    }),
    async (c) => c.json(ok(service.holidays(c.req.valid("query").year)), 200),
  );
  route.openapi(
    createRoute({
      method: "patch",
      path: "/exception",
      tags: ["Due date rules"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SetDueDateExceptionInputSchema } },
        },
      },
      responses: {
        200: response(z.object({ excluded: z.boolean() })),
        ...errors,
        404: {
          description: "Due date target not found",
          content: { "application/json": { schema: ErrorResponseSchema } },
        },
      },
    }),
    async (c) => c.json(ok(await service.setException(c.req.valid("json"), c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "put",
      path: "/",
      tags: ["Due date rules"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SaveDueDateRulesInputSchema } },
        },
      },
      responses: { 200: response(DueDateRulesOutputSchema), ...errors },
    }),
    async (c) => c.json(ok(await service.save(c.req.valid("json"), c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "post",
      path: "/preview",
      tags: ["Due date rules"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SaveDueDateRulesInputSchema } },
        },
      },
      responses: { 200: response(DueDateRulesPreviewSchema), ...errors },
    }),
    async (c) => c.json(ok(await service.preview(c.req.valid("json"), c.get("userId"))), 200),
  );
  return route;
}
