import {
  type DueDateRulesOutput,
  SaveDueDateRulesInputSchema,
} from "@openmonetis/validators/due-date-rules";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import {
  usePreviewDueDateRulesMutation,
  useSaveDueDateRulesMutation,
} from "./due-date-rules.mutations";
import { dueDateRulesErrorMessage } from "./due-date-rules.presentation";
export function useDueDateRulesForm(config: DueDateRulesOutput) {
  const save = useSaveDueDateRulesMutation();
  const preview = usePreviewDueDateRulesMutation();
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      revision: config.revision,
      calendar: config.calendar,
      rules: config.rules,
    },
    validators: {
      onSubmit: ({ value }) =>
        SaveDueDateRulesInputSchema.safeParse(value).success
          ? undefined
          : "Confira as regras e selecione os itens necessários.",
    },
    onSubmitInvalid: () => toast.error("Confira as regras e selecione os itens necessários."),
    onSubmit: async ({ value }) => {
      if (previewFingerprint !== JSON.stringify(value)) {
        toast.error("Calcule a prévia antes de salvar.");
        return;
      }
      try {
        await save.mutateAsync(
          SaveDueDateRulesInputSchema.parse({ ...value, effectiveFrom: preview.data?.from }),
        );
        toast.success("Regras de vencimento salvas");
      } catch (error) {
        toast.error(dueDateRulesErrorMessage(error));
      }
    },
  });
  async function calculatePreview() {
    const input = SaveDueDateRulesInputSchema.safeParse(form.state.values);
    if (!input.success) {
      toast.error("Confira as regras e selecione os itens necessários.");
      return;
    }
    setPreviewFingerprint(null);
    try {
      const fingerprint = JSON.stringify(form.state.values);
      await preview.mutateAsync(input.data);
      setPreviewFingerprint(fingerprint);
    } catch (error) {
      toast.error(dueDateRulesErrorMessage(error));
    }
  }
  function discardChanges() {
    form.reset();
    setPreviewFingerprint(null);
    preview.reset();
  }
  return { form, preview, previewFingerprint, calculatePreview, discardChanges };
}
