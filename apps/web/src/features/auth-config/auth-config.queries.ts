import { queryOptions } from "@tanstack/react-query";
import { getAuthConfig } from "./auth-config.api";

export function authConfigQueryOptions() {
  return queryOptions({
    queryKey: ["auth-config"],
    queryFn: getAuthConfig,
    staleTime: 0,
  });
}
