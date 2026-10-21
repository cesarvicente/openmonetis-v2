import type {
  DueDateRuleOptions,
  DueDateRulesOutput,
} from "@openmonetis/validators/due-date-rules";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ListChecks, Plus } from "lucide-react";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createDueDateRule, formatDueDate } from "../due-date-rules.presentation";
import {
  dueDateRuleOptionsQueryOptions,
  dueDateRulesQueryOptions,
} from "../due-date-rules.queries";
import { useDueDateRulesForm } from "../useDueDateRulesForm";
import { DueDateRuleFields } from "./due-date-rule-fields";
import { DueDateRulesCalendar } from "./due-date-rules-calendar";
export function DueDateRulesPage() {
  const config = useQuery(dueDateRulesQueryOptions());
  const options = useQuery(dueDateRuleOptionsQueryOptions());
  if (config.isPending || options.isPending) return <Skeleton className="h-80 rounded-xl" />;
  if (!config.data || !options.data)
    return (
      <SettingsQueryError
        message="Não foi possível carregar as regras de vencimento."
        isRetrying={config.isFetching || options.isFetching}
        onRetry={() => {
          void config.refetch();
          void options.refetch();
        }}
      />
    );
  return (
    <DueDateRulesEditor key={config.data.revision} config={config.data} options={options.data} />
  );
}
function DueDateRulesEditor({
  config,
  options,
}: {
  config: DueDateRulesOutput;
  options: DueDateRuleOptions;
}) {
  const { form, preview, previewFingerprint, calculatePreview, discardChanges } =
    useDueDateRulesForm(config);
  return (
    <form
      className="grid min-w-0 gap-4"
      data-mobile-page-form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({
          values: state.values,
          isSubmitting: state.isSubmitting,
          isDirty: state.isDirty,
        })}
      >
        {({ values, isSubmitting, isDirty }) => {
          const disabled = isSubmitting || preview.isPending;
          const previewCurrent = previewFingerprint === JSON.stringify(values);
          return (
            <>
              <SettingsPanel>
                <SettingsSection
                  icon={CalendarClock}
                  title="Ajuste automático"
                  description="Contas a pagar e faturas passam para o próximo dia útil em fins de semana e feriados."
                >
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    As regras salvas valem para vencimentos de hoje em diante. Pagamentos
                    confirmados mantêm suas datas.
                  </p>
                </SettingsSection>
                <SettingsSection
                  icon={ListChecks}
                  title="Personalizações e exceções"
                  description="Escolha os itens e o ajuste. Cada item pode ser abrangido por uma regra."
                >
                  <form.Field name="rules">
                    {(field) => (
                      <div className="grid gap-4">
                        {field.state.value.length ? (
                          field.state.value.map((rule, index) => (
                            <DueDateRuleFields
                              key={rule.id}
                              rule={rule}
                              options={options}
                              disabled={disabled}
                              onChange={(next) =>
                                field.handleChange(
                                  field.state.value.map((item, i) => (i === index ? next : item)),
                                )
                              }
                              onRemove={() =>
                                field.handleChange(
                                  field.state.value.filter((item) => item.id !== rule.id),
                                )
                              }
                            />
                          ))
                        ) : (
                          <p className="rounded-lg border border-dashed p-5 text-muted-foreground text-sm">
                            Nenhuma personalização cadastrada. Contas a pagar e faturas usam o
                            próximo dia útil automaticamente.
                          </p>
                        )}
                        <Button
                          className="justify-self-start"
                          type="button"
                          variant="outline"
                          disabled={disabled || field.state.value.length >= 50}
                          onClick={() =>
                            field.handleChange([...field.state.value, createDueDateRule()])
                          }
                        >
                          <Plus aria-hidden="true" className="size-4" />
                          Adicionar personalização
                        </Button>
                      </div>
                    )}
                  </form.Field>
                </SettingsSection>
                <DueDateRulesCalendar form={form} disabled={disabled} />
              </SettingsPanel>
              {previewCurrent && preview.data ? (
                <section className="grid gap-3 rounded-xl border p-5" aria-live="polite">
                  <h2 className="font-medium">Prévia dos vencimentos</h2>
                  <p className="text-muted-foreground text-sm">
                    De {formatDueDate(preview.data.from)} a {formatDueDate(preview.data.through)} ·{" "}
                    {preview.data.items.length === 1
                      ? "1 vencimento será alterado."
                      : `${preview.data.items.length} vencimentos serão alterados.`}
                  </p>
                  {preview.data.items.length ? (
                    <ul className="grid max-h-80 gap-3 overflow-y-auto">
                      {preview.data.items.map((item) => (
                        <li
                          key={item.id}
                          className="grid gap-1 border-b pb-3 text-sm last:border-0"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span>
                            {formatDueDate(item.currentDueDate)} → {formatDueDate(item.dueDate)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Original: {formatDueDate(item.originalDueDate)}
                            {item.ruleName
                              ? ` · ${item.ruleName}`
                              : item.dueDate === item.originalDueDate
                                ? " · data original"
                                : " · ajuste automático"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhum vencimento pendente será alterado neste período. As regras também serão
                      usadas nos próximos cadastros.
                    </p>
                  )}
                </section>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm" aria-live="polite">
                  {!isDirty
                    ? "Nenhuma alteração para salvar."
                    : previewCurrent
                      ? "Confira a prévia e salve para aplicar."
                      : "Alterações não salvas. Revise o impacto antes de aplicar."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isDirty ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                      onClick={discardChanges}
                    >
                      Descartar alterações
                    </Button>
                  ) : null}
                  {previewCurrent ? (
                    <Button type="submit" disabled={disabled || !isDirty}>
                      {isSubmitting ? "Salvando…" : "Salvar regras"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={disabled || !isDirty}
                      onClick={() => void calculatePreview()}
                    >
                      {preview.isPending ? "Calculando…" : "Revisar alterações"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
