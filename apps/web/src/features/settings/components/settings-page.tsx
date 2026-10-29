import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  KeyRound,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { SettingsPanel } from "@/components/settings-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeySettings } from "@/features/api-keys/components/api-key-settings";
import { DueDateRulesPage } from "@/features/due-date-rules/components/due-date-rules-page";
import { PreferencesForm } from "@/features/preferences/components/preferences-form";
import { type SettingsTab, settingsTabs } from "../settings.presentation";
import { CompanionSettings } from "./companion-settings";
import { SecuritySettings } from "./security-settings";
import { SettingsDangerZone } from "./settings-danger-zone";

export function SettingsPage() {
  const search = useSearch({ from: "/settings" });
  const navigate = useNavigate({ from: "/settings" });
  const activeTab = settingsTabs.includes(search.tab as SettingsTab)
    ? (search.tab as SettingsTab)
    : "preferences";

  function changeTab(value: string) {
    const tab = value as SettingsTab;
    void navigate({
      replace: true,
      search: { tab: tab === "preferences" ? undefined : tab },
    });
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Ajustes" }]}
            description="Gerencie sua experiência, integrações e os dados vinculados à sua conta."
            eyebrow="Conta"
            icon={<Settings aria-hidden="true" className="size-5" />}
            title="Ajustes"
          />

          <Tabs className="min-w-0 gap-0" onValueChange={changeTab} value={activeTab}>
            <div className="relative">
              <div className="overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                <TabsList className="min-w-max" variant="line">
                  <TabsTrigger value="preferences">
                    <SlidersHorizontal aria-hidden="true" />
                    Preferências
                  </TabsTrigger>
                  <TabsTrigger value="due-date-rules">
                    <CalendarClock aria-hidden="true" />
                    Regras de vencimento
                  </TabsTrigger>
                  <TabsTrigger value="security">
                    <ShieldCheck aria-hidden="true" />
                    Segurança
                  </TabsTrigger>
                  <TabsTrigger value="companion">
                    <Smartphone aria-hidden="true" />
                    Companion
                  </TabsTrigger>
                  <TabsTrigger value="api">
                    <KeyRound aria-hidden="true" />
                    Acesso à API
                  </TabsTrigger>
                  <TabsTrigger value="danger-zone">
                    <TriangleAlert aria-hidden="true" />
                    Ações perigosas
                  </TabsTrigger>
                </TabsList>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent sm:hidden"
              />
            </div>

            <TabsContent className="pt-5" value="preferences">
              <PreferencesForm />
            </TabsContent>

            <TabsContent className="pt-5" value="due-date-rules">
              <DueDateRulesPage />
            </TabsContent>
            <TabsContent className="pt-5" value="companion">
              <CompanionSettings />
            </TabsContent>

            <TabsContent className="pt-5" value="api">
              <SettingsPanel>
                <ApiKeySettings />
              </SettingsPanel>
            </TabsContent>

            <TabsContent className="pt-5" value="security">
              <SecuritySettings />
            </TabsContent>

            <TabsContent className="pt-5" value="danger-zone">
              <SettingsDangerZone />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </ProtectedRoute>
  );
}
