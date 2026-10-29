import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";

type ResetPasswordSearch = { token?: string };

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha · OpenMonetis" }] }),
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch =>
    typeof search.token === "string" && search.token ? { token: search.token } : {},
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  return (
    <AuthPageLayout
      description={
        token ? "Escolha uma nova senha para sua conta." : "Este link é inválido ou expirou."
      }
      title="Redefinir senha"
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Button asChild variant="outline">
          <Link to="/forgot-password">Pedir um novo link</Link>
        </Button>
      )}
    </AuthPageLayout>
  );
}
