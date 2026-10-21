import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateTagInputSchema,
  TagOutputSchema,
  TagParamsSchema,
  TagsReportOutputSchema,
  TagsReportQuerySchema,
  UpdateTagInputSchema,
} from "@openmonetis/validators/tags";
import type { TagsService } from "../services/tags.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const response = (schema: z.ZodType, description: string) => ({
  description,
  content: { "application/json": { schema: z.object({ data: schema, error: z.null() }) } },
});
export function createTagsRoute(service: TagsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Tags"],
      responses: {
        200: response(z.array(TagOutputSchema), "List tags"),
        401: error("Authentication required"),
      },
    }),
    async (c) => c.json(ok(await service.list(c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/report",
      tags: ["Tags"],
      request: { query: TagsReportQuerySchema },
      responses: {
        200: response(TagsReportOutputSchema, "Monthly totals per tag"),
        400: error("Invalid request"),
        401: error("Authentication required"),
      },
    }),
    async (c) =>
      c.json(ok(await service.report(c.req.valid("query").period, c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Tags"],
      request: {
        body: { required: true, content: { "application/json": { schema: CreateTagInputSchema } } },
      },
      responses: {
        201: response(TagOutputSchema, "Created tag"),
        400: error("Invalid request"),
        401: error("Authentication required"),
        409: error("Tag already exists"),
      },
    }),
    async (c) => c.json(ok(await service.create(c.req.valid("json"), c.get("userId"))), 201),
  );
  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Tags"],
      request: {
        params: TagParamsSchema,
        body: { required: true, content: { "application/json": { schema: UpdateTagInputSchema } } },
      },
      responses: {
        200: response(TagOutputSchema, "Updated tag"),
        400: error("Invalid request"),
        401: error("Authentication required"),
        404: error("Tag not found"),
        409: error("Tag already exists"),
      },
    }),
    async (c) =>
      c.json(
        ok(await service.update(c.req.valid("param").id, c.req.valid("json"), c.get("userId"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Tags"],
      request: { params: TagParamsSchema },
      responses: {
        200: response(z.object({ id: z.uuid() }), "Deleted tag and its assignments"),
        400: error("Invalid request"),
        401: error("Authentication required"),
        404: error("Tag not found"),
      },
    }),
    async (c) => c.json(ok(await service.remove(c.req.valid("param").id, c.get("userId"))), 200),
  );
  return route;
}
