import {
  type CreateTagInput,
  CreateTagInputSchema,
  type TagOutput,
} from "@openmonetis/validators/tags";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { getTagErrorMessage } from "../tags.presentation";
export function TagForm({
  tag,
  onSubmit,
  onCancel,
}: {
  tag: TagOutput | null;
  onSubmit: (input: CreateTagInput) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: tag?.name ?? "" },
    validators: { onSubmit: CreateTagInputSchema },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await onSubmit(CreateTagInputSchema.parse(value));
        toast.success(tag ? "Etiqueta atualizada" : "Etiqueta criada");
      } catch (cause) {
        setError(getTagErrorMessage(cause));
      }
    },
  });
  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <form.Field name="name">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={id}>Nome</Label>
            <Input
              autoFocus
              id={id}
              maxLength={80}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Ex.: Viagem"
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.length ? (
              <p className="text-destructive text-sm" role="alert">
                Informe um nome com até 80 caracteres.
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <div data-mobile-form-actions className="grid grid-cols-2 gap-2">
            <Button
              data-mobile-cancel
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
