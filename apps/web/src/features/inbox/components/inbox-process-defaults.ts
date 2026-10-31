import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
import type { InboxRuleSuggestionOutput } from "@openmonetis/validators/inbox-rules";

import type { TransactionCreateDefaults } from "@/features/transactions/components/transaction-form.validation";

import { getInboxPurchaseDate, getInboxSourceMatch } from "../inbox.presentation";

export function getProcessDefaults(
  item: InboxItemSummaryOutput,
  accounts: AccountOutput[],
  cards: CardOutput[],
  suggestion: InboxRuleSuggestionOutput | null,
): TransactionCreateDefaults {
  const sourceMatch = getInboxSourceMatch(item.sourceAppName, accounts, cards);
  const suggestedMethod = suggestion?.paymentMethod ?? null;
  const sourceCardId = sourceMatch?.kind === "card" ? sourceMatch.id : undefined;
  const sourceAccountId = sourceMatch?.kind === "account" ? sourceMatch.id : undefined;
  const matchedCardId =
    suggestedMethod === null
      ? sourceCardId
      : suggestedMethod === "credit_card"
        ? (suggestion?.cardId ?? sourceCardId)
        : undefined;
  const matchedAccountId =
    suggestedMethod === null
      ? sourceAccountId
      : suggestedMethod === "credit_card"
        ? undefined
        : (suggestion?.accountId ?? sourceAccountId);
  const fallbackAccountId = accounts.find((candidate) => !candidate.isArchived)?.id;

  return {
    name: item.parsedName ?? "",
    amount: item.parsedAmount === null ? "" : String(item.parsedAmount),
    purchaseDate: getInboxPurchaseDate(item.notificationTimestamp),
    paymentMethod: suggestedMethod ?? (matchedCardId ? "credit_card" : "pix"),
    cardId: matchedCardId,
    accountId: matchedCardId ? undefined : (matchedAccountId ?? fallbackAccountId),
    categoryId: suggestion?.categoryId ?? undefined,
    personId: suggestion?.personId ?? undefined,
  };
}
