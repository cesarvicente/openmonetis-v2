import type { InboxRuleConditionField } from "@openmonetis/domain/inbox-rules";
import type {
  InboxRuleCondition,
  InboxRuleOutput,
  InboxRuleSuggestionOutput,
} from "@openmonetis/validators/inbox-rules";

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

/** Encodes the rule card/account as one select value: "card:<id>", "account:<id>" or "none". */
export function toInboxRulePaymentTarget(rule: InboxRuleOutput | null) {
  if (rule?.card) return `card:${rule.card.id}`;
  if (rule?.account) return `account:${rule.account.id}`;
  return "none";
}

export function parseInboxRulePaymentTarget(value: string) {
  const [kind, id] = value.split(":");
  return {
    cardId: kind === "card" && id ? id : null,
    accountId: kind === "account" && id ? id : null,
  };
}

export function describeInboxRuleActions(rule: InboxRuleOutput) {
  return [
    rule.category ? `categoria ${rule.category.name}` : null,
    rule.person ? `pessoa ${rule.person.name}` : null,
    rule.card ? `cartão ${rule.card.name}` : null,
    rule.account ? `conta ${rule.account.name}` : null,
  ]
    .filter(Boolean)
    .join(" e ");
}

export function describeInboxRuleSuggestion(suggestion: InboxRuleSuggestionOutput | null) {
  if (!suggestion?.appliedRules.length) return undefined;
  const names = suggestion.appliedRules.map((rule) => rule.name).join(", ");
  return `Alguns campos foram sugeridos pelas regras: ${names}. Revise antes de salvar.`;
}
