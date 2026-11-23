import {
  InstallmentOptionsQuerySchema,
  type TransactionOutput,
} from "@openmonetis/validators/transactions";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getInstallmentOptions,
  getLinkedReimbursements,
  getPartialPayments,
  getRecentEstablishments,
  getRecurringLinkedReimbursements,
  getTransaction,
  getTransactions,
  type TransactionsApiSearch,
} from "./transactions.api";

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (search: TransactionsApiSearch) => [...transactionKeys.all, search] as const,
  detail: (id: string) => [...transactionKeys.all, "detail", id] as const,
  linkedReimbursements: (key: string) =>
    [...transactionKeys.all, "linked-reimbursements", key] as const,
  partialPayments: (id: string) => [...transactionKeys.all, "partial-payments", id] as const,
  recentEstablishments: () => [...transactionKeys.all, "recent-establishments"] as const,
  installmentOptions: (amount: number | null) =>
    [...transactionKeys.all, "installment-options", amount] as const,
};

export function installmentOptionsQueryOptions(amount: string, enabled: boolean) {
  const parsed = InstallmentOptionsQuerySchema.safeParse({ amount });
  return queryOptions({
    queryKey: transactionKeys.installmentOptions(parsed.success ? parsed.data.amount : null),
    enabled: enabled && parsed.success,
    queryFn: () => getInstallmentOptions(InstallmentOptionsQuerySchema.parse({ amount }).amount),
    staleTime: 60_000,
  });
}

export function transactionsQueryOptions(search: TransactionsApiSearch) {
  return queryOptions({
    queryKey: transactionKeys.list(search),
    placeholderData: keepPreviousData,
    queryFn: () => getTransactions(search),
  });
}

export function transactionDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: transactionKeys.detail(id),
    queryFn: () => getTransaction(id),
  });
}

export function recentEstablishmentsQueryOptions() {
  return queryOptions({
    queryKey: transactionKeys.recentEstablishments(),
    queryFn: getRecentEstablishments,
    staleTime: 5 * 60 * 1000,
  });
}

export type LinkedReimbursementsTarget = Pick<
  TransactionOutput,
  "recordId" | "recurringRuleId" | "purchaseDate"
>;

export function linkedReimbursementsQueryOptions(target: LinkedReimbursementsTarget) {
  const { purchaseDate, recordId, recurringRuleId } = target;
  return queryOptions({
    queryKey: transactionKeys.linkedReimbursements(
      recordId ?? `${recurringRuleId}:${purchaseDate}`,
    ),
    queryFn: () =>
      recordId
        ? getLinkedReimbursements(recordId)
        : getRecurringLinkedReimbursements(recurringRuleId as string, purchaseDate),
  });
}

export function partialPaymentsQueryOptions(id: string) {
  return queryOptions({
    queryKey: transactionKeys.partialPayments(id),
    queryFn: () => getPartialPayments(id),
  });
}
