import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiKey, revokeApiKey } from "./api-keys.api";
import { apiKeyKeys } from "./api-keys.queries";

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
}
