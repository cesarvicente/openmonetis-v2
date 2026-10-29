import { queryOptions } from "@tanstack/react-query";
import { getSignupAllowlist } from "./signup-allowlist.api";

export const signupAllowlistKeys = { all: ["signup-allowlist"] as const };

export function signupAllowlistQueryOptions() {
  return queryOptions({ queryKey: signupAllowlistKeys.all, queryFn: getSignupAllowlist });
}
