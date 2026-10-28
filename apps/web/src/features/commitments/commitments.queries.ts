import type { ListCommitmentsQuery } from "@openmonetis/validators/commitments";
import { queryOptions } from "@tanstack/react-query";
import { getCommitments } from "./commitments.api";

export function commitmentsQueryOptions(query: ListCommitmentsQuery) {
  return queryOptions({
    queryKey: ["commitments", query.startPeriod, query.endPeriod],
    queryFn: () => getCommitments(query),
  });
}
