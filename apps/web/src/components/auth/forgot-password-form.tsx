import { RequestPasswordResetInputSchema } from "@openmonetis/validators/auth";
import { useForm } from "@tanstack/react-form";
import { MailCheck, Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const input = RequestPasswordResetInputSchema.safeParse(value);
      if (!input.success) {
        setError("Informe um e-mail válido.");
        return;
      }

      const result = await authClient
        .requestPasswordReset({ email: input.data.email, redirectTo: "/reset-password" })
        .catch(() => null);
      if (!result) {
        setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
        return;
      }
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Muitas solicitações. Aguarde um minuto e tente novamente."
            : "Não foi possível enviar o link agora. Tente novamente em instantes.",
        );
        return;
      }

      setSentTo(input.data.email);
    },
  });

  if (sentTo) {
    return (
      <div className="grid gap-3" role="status">
        <MailCheck aria-hidden="true" className="size-8 text-brand-strong" />
        <p className="font-medium">Verifique seu e-mail</p>
        <p className="text-muted-foreground text-sm">
          Se existir uma conta para <strong>{sentTo}</strong>, você receberá um link para redefinir
          a senha. O link vale por 1 hora.
        </p>
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
        name="email"
        validators={{
          onBlur: ({ value }) =>
            RequestPasswordResetInputSchema.shape.email.safeParse(value).success
              ? undefined
              : "Informe um e-mail válido.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>E-mail</Label>
            <Input
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="email"
              id={`${id}-email`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              type="email"
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
            <Send aria-hidden="true" className="size-4" />
            {isSubmitting ? "Enviando" : "Enviar link"}
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
