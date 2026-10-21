import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { previewDueDateRules, saveDueDateRules, setDueDateException } from "./due-date-rules.api";
import { dueDateRuleKeys } from "./due-date-rules.queries";
export function useSaveDueDateRulesMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveDueDateRules,
    onSuccess: async (saved) => {
      client.setQueryData(dueDateRuleKeys.all, saved);
      await refreshFinancialQueries(client);
    },
  });
}
export const usePreviewDueDateRulesMutation = () =>
  useMutation({ mutationFn: previewDueDateRules });

export function useSetDueDateExceptionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: setDueDateException,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
