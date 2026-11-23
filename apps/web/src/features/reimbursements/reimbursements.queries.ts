import { queryOptions } from "@tanstack/react-query";
import { getReimbursementsSummary } from "./reimbursements.api";

export const reimbursementKeys = {
  all: ["reimbursements"] as const,
  summary: (period: string) => ["reimbursements", "summary", period] as const,
};

export const reimbursementsSummaryQueryOptions = (period: string) =>
  queryOptions({
    queryKey: reimbursementKeys.summary(period),
    queryFn: () => getReimbursementsSummary(period),
  });
