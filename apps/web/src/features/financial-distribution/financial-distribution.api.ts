import type {
  FinancialDistributionOutput,
  ListFinancialDistributionQuery,
} from "@openmonetis/validators/financial-distribution";
import { requestApi } from "@/lib/api-client";

export function getFinancialDistribution(query: ListFinancialDistributionQuery) {
  const params = new URLSearchParams(query);
  return requestApi<FinancialDistributionOutput>(
    `/reports/financial-distribution?${params}`,
    undefined,
    { useResponseMessage: true },
  );
}
