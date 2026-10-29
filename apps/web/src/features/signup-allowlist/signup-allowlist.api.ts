import type {
  CreateSignupAllowlistEntryInput,
  SignupAllowlistEntryOutput,
} from "@openmonetis/validators/signup-allowlist";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { errorMessage: "signup_allowlist_request_failed" });
}

export function getSignupAllowlist() {
  return request<SignupAllowlistEntryOutput[]>("/admin/signup-allowlist");
}

export function createSignupAllowlistEntry(input: CreateSignupAllowlistEntryInput) {
  return request<SignupAllowlistEntryOutput>("/admin/signup-allowlist", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeSignupAllowlistEntry(id: string) {
  return request<{ id: string }>(`/admin/signup-allowlist/${id}`, { method: "DELETE" });
}
