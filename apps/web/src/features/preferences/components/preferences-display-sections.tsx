import {
  type ApplicationColorTheme,
  applicationColorThemes,
  applicationThemes,
} from "@openmonetis/domain/preferences";
import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import { Check, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { useId } from "react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SettingsSection } from "@/components/settings-panel";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { colorThemeDescriptions, colorThemeLabels } from "../preferences.presentation";
import type { PreferencesFormApi } from "../usePreferencesForm";

export function PreferencesDisplaySections({
  form,
  disabled: isMutating,
}: {
  form: PreferencesFormApi;
  disabled: boolean;
}) {
  const privacyId = useId();
  const colorThemeId = useId();
  return (
    <>
      <SettingsSection
        description="Escolha o modo e a paleta de cores. A paleta aparece na hora; salve para mantê-la."
        icon={Sun}
        title="Aparência"
      >
        <form.Field name="theme">
          {(field) => (
            <fieldset className="grid grid-cols-3 gap-2 sm:gap-3" disabled={isMutating}>
              <legend className="sr-only">Tema do aplicativo</legend>
              {applicationThemes.map((theme) => {
                const ThemeIcon = themeIcons[theme];
                const selected = field.state.value === theme;

                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "relative flex min-h-20 flex-col items-start rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-brand-strong/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                      selected && "border-brand-strong/50 bg-brand/10 ring-1 ring-brand-strong/20",
                    )}
                    key={theme}
                    onClick={() => field.handleChange(theme)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-md bg-muted text-muted-foreground transition-colors",
                        selected && "bg-brand/15 text-brand-strong",
                      )}
                    >
                      <ThemeIcon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="mt-2 font-medium text-sm">{themeLabels[theme]}</span>
                    <span className="mt-0.5 hidden text-muted-foreground text-xs sm:block">
                      {themeDescriptions[theme]}
                    </span>
                    {selected ? (
                      <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
                        <Check aria-hidden="true" className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </fieldset>
          )}
        </form.Field>
        <form.Field name="colorTheme">
          {(field) => (
            <div className="mt-4 grid gap-1.5">
              <Label htmlFor={colorThemeId}>Paleta de cores</Label>
              <Select
                disabled={isMutating}
                onValueChange={(value) => value && field.handleChange(value)}
                value={field.state.value}
              >
                <SelectTrigger
                  aria-describedby={`${colorThemeId}-description`}
                  className="h-auto min-h-11 w-full"
                  id={colorThemeId}
                >
                  <SelectValue>
                    <ColorThemeOption colorTheme={field.state.value} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {applicationColorThemes.map((colorTheme) => (
                    <SelectItem key={colorTheme} value={colorTheme}>
                      <ColorThemeOption colorTheme={colorTheme} described />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs" id={`${colorThemeId}-description`}>
                Cada paleta tem versão clara e escura; o botão de tema no topo alterna entre elas.
                Sem salvar, a paleta anterior volta ao sair dos ajustes.
              </p>
            </div>
          )}
        </form.Field>
      </SettingsSection>

      <SettingsSection
        description="Controle como seus dados aparecem ao abrir o aplicativo."
        icon={ShieldCheck}
        title="Privacidade"
      >
        <form.Field name="hideValuesOnStart">
          {(field) => (
            <div className="flex items-start justify-between gap-6 py-1">
              <div className="flex min-w-0 items-start gap-3">
                <div>
                  <Label
                    className="cursor-pointer normal-case font-sans text-sm tracking-normal"
                    htmlFor={privacyId}
                  >
                    Ocultar valores ao entrar
                  </Label>
                  <p
                    className="mt-1 text-muted-foreground text-sm leading-relaxed"
                    id={`${privacyId}-description`}
                  >
                    Nos próximos acessos, os valores começam ocultos. Use o ícone de olho no
                    cabeçalho para revelá-los.
                  </p>
                </div>
              </div>
              <Switch
                aria-describedby={`${privacyId}-description`}
                checked={field.state.value}
                className="mt-0.5 shrink-0"
                disabled={isMutating}
                id={privacyId}
                onCheckedChange={field.handleChange}
              />
            </div>
          )}
        </form.Field>
      </SettingsSection>
    </>
  );
}
function ColorThemeOption({
  colorTheme,
  described = false,
}: {
  colorTheme: ApplicationColorTheme;
  described?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background p-1"
        data-color-theme={colorTheme}
      >
        <span className="size-3.5 rounded-full bg-brand" />
        <span className="size-3.5 rounded-full bg-foreground" />
        <span className="size-3.5 rounded-full border border-border bg-card" />
      </span>
      <span className="grid min-w-0 text-left">
        <span className="truncate">{colorThemeLabels[colorTheme]}</span>
        {described ? (
          <span className="truncate text-muted-foreground text-xs">
            {colorThemeDescriptions[colorTheme]}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const themeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} satisfies Record<UserPreferencesOutput["theme"], typeof Sun>;

const themeLabels = {
  system: "Sistema",
  light: "Claro",
  dark: "Escuro",
} satisfies Record<UserPreferencesOutput["theme"], string>;

const themeDescriptions = {
  system: "Segue seu dispositivo",
  light: "Tema claro",
  dark: "Tema escuro",
} satisfies Record<UserPreferencesOutput["theme"], string>;
