import type { CommitmentsOutput, ListCommitmentsQuery } from "@openmonetis/validators/commitments";
import { requestApi } from "@/lib/api-client";

export function getCommitments(query: ListCommitmentsQuery) {
  const params = new URLSearchParams({
    startPeriod: query.startPeriod,
    endPeriod: query.endPeriod,
  });
  return requestApi<CommitmentsOutput>(`/reports/commitments?${params}`, undefined, {
    useResponseMessage: true,
  });
}
