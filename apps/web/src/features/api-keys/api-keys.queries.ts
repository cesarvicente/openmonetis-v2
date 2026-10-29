import { queryOptions } from "@tanstack/react-query";
import { getApiKeys } from "./api-keys.api";

export const apiKeyKeys = { all: ["api-keys"] as const };

export function apiKeysQueryOptions() {
  return queryOptions({ queryKey: apiKeyKeys.all, queryFn: getApiKeys });
}
