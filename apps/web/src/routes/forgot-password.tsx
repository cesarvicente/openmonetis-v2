import { createFileRoute } from "@tanstack/react-router";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Esqueci minha senha · OpenMonetis" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      description="Informe o e-mail da sua conta para receber um link de redefinição."
      title="Esqueci minha senha"
    >
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}
