import type { InboxRuleConditionField } from "@openmonetis/domain/inbox-rules";
import type {
  InboxRuleCondition,
  InboxRuleOutput,
  InboxRuleSuggestionOutput,
} from "@openmonetis/validators/inbox-rules";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";

export const inboxRuleFieldLabels: Record<InboxRuleConditionField, string> = {
  sourceApp: "Identificador do app",
  sourceAppName: "Nome do app",
  originalTitle: "Título da notificação",
  originalText: "Texto da notificação",
  parsedName: "Nome identificado",
  parsedAmount: "Valor identificado",
};

export const inboxRuleTextOperatorLabels = {
  contains: "contém",
  equals: "é igual a",
  startsWith: "começa com",
  endsWith: "termina com",
} as const;

export const inboxRuleAmountOperatorLabels = {
  equals: "é igual a",
  greaterThan: "é maior que",
  lessThan: "é menor que",
} as const;

export function formatInboxRuleCondition(condition: InboxRuleCondition) {
  const operator =
    condition.field === "parsedAmount"
      ? inboxRuleAmountOperatorLabels[condition.operator]
      : inboxRuleTextOperatorLabels[condition.operator];
  const value =
    condition.field === "parsedAmount"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          condition.value,
        )
      : `“${condition.value}”`;
  return `${inboxRuleFieldLabels[condition.field]} ${operator} ${value}`;
}

export function describeInboxRuleActions(rule: InboxRuleOutput) {
  return [
    rule.category ? `categoria ${rule.category.name}` : null,
    rule.person ? `pessoa ${rule.person.name}` : null,
    rule.paymentMethod
      ? [paymentMethodLabels[rule.paymentMethod], rule.card?.name ?? rule.account?.name]
          .filter(Boolean)
          .join(" · ")
      : null,
  ]
    .filter(Boolean)
    .join(" e ");
}

export function describeInboxRuleSuggestion(suggestion: InboxRuleSuggestionOutput | null) {
  if (!suggestion?.appliedRules.length) return undefined;
  const names = suggestion.appliedRules.map((rule) => rule.name).join(", ");
  return `Alguns campos foram sugeridos pelas regras: ${names}. Revise antes de salvar.`;
}

const inboxRuleFormErrorMessages: Record<string, string> = {
  name: "Informe o nome da regra.",
  priority: "Informe uma ordem de aplicação entre 0 e 9999.",
  conditions: "Preencha o valor de todas as condições.",
  paymentMethod: "O cartão só vale para cartão de crédito, e a conta para as demais formas.",
};

/** Turns the first schema issue of the rule form into a short message for the user. */
export function getInboxRuleFormErrorMessage(issues: Array<{ path: PropertyKey[] }>) {
  const field = issues[0]?.path[0];
  if (field === undefined) return "Escolha ao menos um campo para preencher.";
  return inboxRuleFormErrorMessages[String(field)] ?? "Revise os campos da regra.";
}
