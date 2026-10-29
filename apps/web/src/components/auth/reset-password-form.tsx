import { PasswordSchema, ResetPasswordFormInputSchema } from "@openmonetis/validators/auth";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const form = useForm({
    defaultValues: { newPassword: "", passwordConfirmation: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const input = ResetPasswordFormInputSchema.safeParse(value);
      if (!input.success) {
        setError("Revise a nova senha.");
        return;
      }

      const result = await authClient
        .resetPassword({ newPassword: input.data.newPassword, token })
        .catch(() => null);
      if (!result) {
        setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
        return;
      }
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Muitas tentativas. Aguarde um minuto e tente novamente."
            : "O link de redefinição é inválido ou expirou. Peça um novo link.",
        );
        return;
      }

      toast.success("Senha redefinida");
      setCompleted(true);
    },
  });

  if (completed) {
    return (
      <div className="grid gap-3" role="status">
        <p className="font-medium">Senha redefinida</p>
        <p className="text-muted-foreground text-sm">
          Por segurança, as sessões abertas foram encerradas. Entre com a nova senha.
        </p>
        <Button asChild>
          <Link to="/">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="newPassword"
        validators={{
          onBlur: ({ value }) =>
            PasswordSchema.safeParse(value).success
              ? undefined
              : "Use uma senha entre 8 e 128 caracteres.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-new-password`}>Nova senha</Label>
            <p id={`${id}-password-help`} className="text-muted-foreground text-xs">
              Use de 8 a 128 caracteres.
            </p>
            <PasswordInput
              aria-describedby={`${id}-password-help`}
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="new-password"
              id={`${id}-new-password`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs">{field.state.meta.errors[0]}</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field
        name="passwordConfirmation"
        validators={{
          onBlur: ({ value }) =>
            value === form.getFieldValue("newPassword") ? undefined : "As senhas não coincidem.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-password-confirmation`}>Confirmar nova senha</Label>
            <PasswordInput
              aria-describedby={`${id}-password-help`}
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="new-password"
              id={`${id}-password-confirmation`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs">{field.state.meta.errors[0]}</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button disabled={isSubmitting} type="submit">
            <KeyRound aria-hidden="true" className="size-4" />
            {isSubmitting ? "Salvando" : "Redefinir senha"}
          </Button>
        )}
      </form.Subscribe>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
