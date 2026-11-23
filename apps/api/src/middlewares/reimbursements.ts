import { createMiddleware } from "hono/factory";
import type { ReimbursementsService } from "../services/reimbursements.service";
import type { ApiVariables } from "../types/context";

/**
 * Any change to expenses, invoices, cards or calendars may change what other people owe. Runs before
 * the response leaves, so the client already reads the reimbursements in line.
 */
export function createReimbursementsSync(service: Pick<ReimbursementsService, "synchronize">) {
  return createMiddleware<{ Variables: ApiVariables }>(async (context, next) => {
    await next();
    if (context.req.method === "GET" || context.res.status >= 400) return;
    await service.synchronize(context.get("userId")).catch((error) => {
      console.error("reimbursements_sync_failed", error);
    });
  });
}
