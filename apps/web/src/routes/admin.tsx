import { createFileRoute } from "@tanstack/react-router";
import { ShieldUser, Users } from "lucide-react";
import { AdminRoute } from "@/components/auth/admin-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignupAllowlistSettings } from "@/features/signup-allowlist/components/signup-allowlist-settings";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel admin · OpenMonetis" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AdminRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Painel admin" }]}
            description="Gerencie quem pode acessar esta instalação."
            eyebrow="Administração"
            icon={<ShieldUser aria-hidden="true" className="size-5" />}
            title="Painel admin"
          />
          <Tabs className="min-w-0 gap-0" defaultValue="signup-allowlist">
            <TabsList className="min-w-max" variant="line">
              <TabsTrigger value="signup-allowlist">
                <Users aria-hidden="true" />
                E-mails autorizados
              </TabsTrigger>
            </TabsList>
            <TabsContent className="pt-5" value="signup-allowlist">
              <SignupAllowlistSettings />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </AdminRoute>
  );
}
