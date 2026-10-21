import { maximumTransactionTags } from "@openmonetis/domain/tags";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TagDialog } from "@/features/tags/components/tag-dialog";
import { TagsPicker } from "@/features/tags/components/tags-picker";
import { useCreateTagMutation } from "@/features/tags/tags.mutations";
import { tagsQueryOptions } from "@/features/tags/tags.queries";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";
import { getTransactionFormErrorMessage } from "./transaction-form.validation";
export function TransactionTagsField({
  form,
  disabled,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  disabled: boolean;
}) {
  const query = useQuery(tagsQueryOptions());
  const create = useCreateTagMutation();
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <form.Field name="tagIds">
        {(field) => (
          <>
            <FieldShell
              label="Etiquetas"
              error={getTransactionFormErrorMessage("tagIds", field.state.meta.errors)}
            >
              <TagsPicker
                tags={query.data ?? []}
                selected={field.state.value}
                maximum={maximumTransactionTags}
                invalid={field.state.meta.errors.length > 0}
                disabled={disabled || query.isLoading || query.isError}
                onChange={field.handleChange}
                onCreate={() => setOpen(true)}
              />
            </FieldShell>
            <TagDialog
              open={open}
              onOpenChange={setOpen}
              onSubmit={async (input) => {
                const tag = await create.mutateAsync(input);
                if (field.state.value.length < maximumTransactionTags)
                  field.handleChange([...field.state.value, tag.id]);
                setOpen(false);
              }}
            />
          </>
        )}
      </form.Field>
      {query.isError ? (
        <p className="text-destructive text-xs" role="alert">
          Não foi possível carregar as etiquetas.{" "}
          <Button size="sm" variant="link" type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : null}
    </div>
  );
}
