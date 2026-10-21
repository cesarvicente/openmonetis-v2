import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { createTag, deleteTag, updateTag } from "./tags.api";
export function useCreateTagMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createTag, onSuccess: () => refreshFinancialQueries(client) });
}
export function useUpdateTagMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: updateTag, onSuccess: () => refreshFinancialQueries(client) });
}
export function useDeleteTagMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteTag, onSuccess: () => refreshFinancialQueries(client) });
}
