import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSignupAllowlistEntry, removeSignupAllowlistEntry } from "./signup-allowlist.api";
import { signupAllowlistKeys } from "./signup-allowlist.queries";

export function useCreateSignupAllowlistEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSignupAllowlistEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: signupAllowlistKeys.all }),
  });
}

export function useRemoveSignupAllowlistEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeSignupAllowlistEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: signupAllowlistKeys.all }),
  });
}
