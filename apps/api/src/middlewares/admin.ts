import { isAdminRole } from "@openmonetis/domain/signup-allowlist";
import { fail } from "@openmonetis/shared/api";
import { createMiddleware } from "hono/factory";
import type { ApiVariables } from "../types/context";

// Runs after requireAuth, which resolves the session role.
export const requireAdmin = createMiddleware<{ Variables: ApiVariables }>(async (context, next) => {
  if (!isAdminRole(context.get("userRole"))) {
    return context.json(fail("Administrator access required", "forbidden"), 403);
  }

  await next();
});
