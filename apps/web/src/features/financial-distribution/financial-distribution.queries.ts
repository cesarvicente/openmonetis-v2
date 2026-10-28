import type { ListFinancialDistributionQuery } from "@openmonetis/validators/financial-distribution";
import { queryOptions } from "@tanstack/react-query";
import { getFinancialDistribution } from "./financial-distribution.api";

export function financialDistributionQueryOptions(query: ListFinancialDistributionQuery) {
  return queryOptions({
    queryKey: ["financial-distribution", query.period, query.personScope, query.mode],
    queryFn: () => getFinancialDistribution(query),
  });
}
