import type { ReimbursementsSummaryOutput } from "@openmonetis/validators/reimbursements";
import { requestApi } from "@/lib/api-client";

export function getReimbursementsSummary(period: string) {
  const query = new URLSearchParams({ period });
  return requestApi<ReimbursementsSummaryOutput>(`/reimbursements?${query.toString()}`);
}
