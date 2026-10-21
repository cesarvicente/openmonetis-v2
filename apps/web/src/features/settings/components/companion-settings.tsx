import { Link } from "@tanstack/react-router";
import { BookOpen, ExternalLink, Inbox } from "lucide-react";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { DeviceTokenSettings } from "@/features/device-tokens/components/device-token-settings";

export function CompanionSettings() {
  return (
    <SettingsPanel>
      <DeviceTokenSettings />
      <SettingsSection
        contentClassName="grid gap-5"
        icon={BookOpen}
        title="Configuração e ajuda"
        description="Receba notificações financeiras do Android e revise antes de criar lançamentos."
      >
        <ol className="grid list-decimal gap-3 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
          <li className="pl-1">
            <span className="font-medium">Instale o Companion</span>{" "}
            <span className="text-muted-foreground">
              no Android que recebe as notificações do banco.
            </span>
          </li>
          <li className="pl-1">
            <span className="font-medium">Configure o endereço HTTPS da API</span>{" "}
            <span className="text-muted-foreground">no Companion.</span>
          </li>
          <li className="pl-1">
            <span className="font-medium">Clique em Conectar aparelho</span>{" "}
            <span className="text-muted-foreground">e escaneie o QR Code ou copie o token.</span>
          </li>
          <li className="pl-1">
            <span className="font-medium">Revise as capturas na Caixa de entrada</span>{" "}
            <span className="text-muted-foreground">e escolha o que salvar.</span>
          </li>
        </ol>
        <p className="text-muted-foreground text-sm leading-relaxed">
          O endereço da API pode ser diferente deste site. Em caso de dúvida, consulte quem
          administra a instalação.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline">
            <a
              href="https://github.com/felipegcoutinho/openmonetis-companion"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" />
              Instalação e ajuda
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link
              to="/inbox"
              search={{
                status: "pending",
                page: undefined,
                app: undefined,
                date: undefined,
                rule: undefined,
              }}
            >
              <Inbox aria-hidden="true" />
              Abrir Caixa de entrada
            </Link>
          </Button>
        </div>
      </SettingsSection>
    </SettingsPanel>
  );
}
