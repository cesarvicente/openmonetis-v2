import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCardInvoiceEntryCount,
  formatInstallmentOption,
  formatPaymentMethod,
  formatPaymentMethodTable,
  getTransactionDateLabel,
  getTransactionSettlementAction,
  getTransactionSettlementLabel,
  groupTransactionRows,
  shouldGroupCardInvoices,
  validateTransactionsSearch,
} from "./transactions.presentation";

test("balance adjustments identify their internal balance correction", () => {
  assert.equal(formatPaymentMethod(null, "accountBalanceAdjustment"), "Ajuste de saldo");
  assert.equal(formatPaymentMethodTable(null, "accountBalanceAdjustment"), "Ajuste de saldo");
  assert.equal(formatPaymentMethod(null), "Não se aplica");
});

test("installment labels do not hide cent redistribution", () => {
  assert.equal(
    formatInstallmentOption(2, { count: 2, minimumAmount: 1.5, maximumAmount: 1.5 }),
    "2x de R$\u00a01,50",
  );
  assert.equal(
    formatInstallmentOption(7, { count: 7, minimumAmount: 0.42, maximumAmount: 0.43 }),
    "7 parcelas · de R$\u00a00,42 a R$\u00a00,43",
  );
  assert.equal(formatInstallmentOption(7), "7x");
});

test("transaction dates describe their financial meaning", () => {
  assert.equal(getTransactionDateLabel("expense", "single"), "Data da compra");
  assert.equal(getTransactionDateLabel("income", "single"), "Data do recebimento");
  assert.equal(getTransactionDateLabel("transfer", "single"), "Data da transferência");
  assert.equal(getTransactionDateLabel("expense", "recurring"), "Início da recorrência");
});

test("split rows connect by record identity, preserving every visible share", () => {
  const share = (id: string, recordId: string | null, date = "2026-09-05") => ({
    id,
    recordId,
    purchaseDate: date,
    recurringRuleId: null as string | null,
    isDivided: true,
    allocation: { personId: id, personName: id, personAvatarUrl: null, amount: -10 },
  });
  const first = share("first", "purchase");
  const unrelated = share("other", "different-purchase");
  const second = share("second", "purchase");
  const third = share("third", "purchase");
  const input = [first, unrelated, second, third];
  assert.deepEqual(
    groupTransactionRows(input).map(({ transaction, splitConnector }) => [
      transaction.id,
      splitConnector,
    ]),
    [
      ["first", "start"],
      ["second", "middle"],
      ["third", "end"],
      ["other", null],
    ],
  );
  assert.deepEqual(input, [first, unrelated, second, third]);
  assert.equal(groupTransactionRows([second])[0].splitConnector, null);
  assert.deepEqual(
    groupTransactionRows([
      { ...share("a", null), recurringRuleId: "rule" },
      { ...share("b", null, "2026-09-12"), recurringRuleId: "rule" },
      { ...share("c", null), recurringRuleId: "rule" },
    ]).map(({ transaction, splitConnector }) => [transaction.id, splitConnector]),
    [
      ["a", "start"],
      ["c", "end"],
      ["b", null],
    ],
  );
  assert.deepEqual(groupTransactionRows([]), []);
});

test("settlement copy distinguishes receipts, payments and invoice-controlled amounts", () => {
  assert.equal(
    getTransactionSettlementLabel({ type: "income", isSettled: true, paymentMethod: "pix" }),
    "Recebido",
  );
  assert.equal(
    getTransactionSettlementAction({ type: "income", isSettled: false }),
    "Registrar recebimento",
  );
  assert.equal(
    getTransactionSettlementLabel({
      type: "expense",
      isSettled: null,
      paymentMethod: "credit_card",
    }),
    "Pagamento pela fatura",
  );
  assert.equal(
    getTransactionSettlementLabel({ type: "expense", isSettled: false, paymentMethod: "pix" }),
    "Em aberto",
  );
  assert.equal(
    getTransactionSettlementAction({ type: "transfer", isSettled: false }),
    "Confirmar transferência",
  );
  assert.equal(
    validateTransactionsSearch({ settlement: "invoice", sort: "dueDate" }).settlement,
    "invoice",
  );
  assert.equal(validateTransactionsSearch({ sort: "invalid" }).sort, undefined);
});

test("tag filters keep stable identifiers when labels are renamed or deleted", () => {
  const id = "a0000000-0000-4000-8000-000000000001";
  assert.equal(validateTransactionsSearch({ tags: `${id},${id.toUpperCase()}` }).tags, id);
  assert.equal(validateTransactionsSearch({ tags: "viagem" }).tags, undefined);
  assert.equal(validateTransactionsSearch({ tags: "" }).tags, undefined);
});
test("untagged URL filters normalize booleans and clear conflicting tag selections", () => {
  const id = "a0000000-0000-4000-8000-000000000001";
  assert.equal(validateTransactionsSearch({ withoutTags: "true", tags: id }).tags, undefined);
  assert.equal(validateTransactionsSearch({ withoutTags: "true" }).withoutTags, true);
  assert.equal(validateTransactionsSearch({ withoutTags: true }).withoutTags, true);
  assert.equal(validateTransactionsSearch({ withoutTags: "false", tags: id }).tags, id);
  assert.equal(validateTransactionsSearch({ withoutTags: "false" }).withoutTags, undefined);
});

test("card entries are grouped by invoice unless the search targets card entries", () => {
  assert.equal(shouldGroupCardInvoices({}), true);
  assert.equal(shouldGroupCardInvoices({ type: "expense" }), true);
  assert.equal(shouldGroupCardInvoices({ type: "income" }), true);
  assert.equal(shouldGroupCardInvoices({ type: "expense", settlement: "unpaid" }), true);
  assert.equal(shouldGroupCardInvoices({ type: "expense", cards: "nubank" }), false);
  assert.equal(shouldGroupCardInvoices({ type: "expense", paymentMethod: "credit_card" }), false);
  assert.equal(shouldGroupCardInvoices({ type: "expense", settlement: "invoice" }), false);
  assert.equal(shouldGroupCardInvoices({ type: "expense", payables: true }), false);
});

test("card invoice rows count their entries", () => {
  assert.equal(formatCardInvoiceEntryCount(1), "1 lançamento");
  assert.equal(formatCardInvoiceEntryCount(3), "3 lançamentos");
});
