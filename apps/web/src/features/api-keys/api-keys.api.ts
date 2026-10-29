import type {
  ApiKeyOutput,
  CreateApiKeyInput,
  CreatedApiKeyOutput,
} from "@openmonetis/validators/api-keys";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { errorMessage: "api_key_request_failed" });
}

export function getApiKeys() {
  return request<ApiKeyOutput[]>("/api-keys");
}

export function createApiKey(input: CreateApiKeyInput) {
  return request<CreatedApiKeyOutput>("/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeApiKey(id: string) {
  return request<{ id: string }>(`/api-keys/${id}`, { method: "DELETE" });
}
