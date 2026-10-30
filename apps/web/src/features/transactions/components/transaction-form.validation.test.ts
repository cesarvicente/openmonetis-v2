import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  getChangedTransactionInput,
  getDefaultTransactionFormValues,
  isSettledByDefault,
  normalizeTransactionInput,
  type TransactionFormValues,
  validateTransactionForm,
} from "./transaction-form.validation";

const paidBoleto = {
  type: "expense",
  condition: "single",
  paymentMethod: "boleto",
  name: "Conta de energia",
  amount: "100",
  purchaseDate: "2026-08-20",
  invoicePeriod: "",
  personId: "10000000-0000-4000-8000-000000000001",
  accountId: "20000000-0000-4000-8000-000000000002",
  cardId: "",
  categoryId: "30000000-0000-4000-8000-000000000003",
  sourceAccountId: "",
  destinationAccountId: "",
  dueDate: "2026-09-03",
  boletoPaymentDate: "2026-08-20",
  installmentCount: "2",
  startInstallment: "1",
  recurrenceFrequency: "monthly",
  recurrenceEndDate: "",
  dueDateRuleExcluded: false,
  autoSettle: false,
  recurrenceAnchorDate: "",
  isSettled: "true",
  note: "",
  splitShares: [],
  tagIds: [],
} satisfies TransactionFormValues;

test("recurrence deadlines are optional, inclusive and validated in the form", () => {
  const recurring: TransactionFormValues = {
    ...paidBoleto,
    condition: "recurring",
    paymentMethod: "pix",
    boletoPaymentDate: "",
    recurrenceEndDate: "2026-08-20",
  };
  assert.equal(validateTransactionForm({ value: recurring }), undefined);
  assert.equal(normalizeTransactionInput(recurring).recurrenceEndDate, "2026-08-20");
  assert.equal(
    normalizeTransactionInput({ ...recurring, recurrenceEndDate: "" }).recurrenceEndDate,
    null,
  );
  assert.ok(
    validateTransactionForm({ value: { ...recurring, recurrenceEndDate: "2026-08-19" } })?.fields
      .recurrenceEndDate,
  );
  assert.equal(
    normalizeTransactionInput({ ...paidBoleto, recurrenceEndDate: "2026-12-31" }).recurrenceEndDate,
    null,
  );
  assert.deepEqual(
    getChangedTransactionInput(
      normalizeTransactionInput({ ...recurring, recurrenceEndDate: "" }),
      { ...recurring, recurrenceEndDate: "" },
      recurring,
    ),
    { recurrenceEndDate: null },
  );
});

test("editing only the name of an installment sends only the name", () => {
  const installment: TransactionFormValues = {
    ...paidBoleto,
    condition: "installment",
    paymentMethod: "pix",
    boletoPaymentDate: "",
    installmentCount: "3",
  };
  const renamed = { ...installment, name: "Nova descrição" };

  assert.deepEqual(
    getChangedTransactionInput(normalizeTransactionInput(renamed), renamed, installment),
    { name: "Nova descrição" },
  );
});

test("paid boleto form preserves a payment date before the due month", () => {
  const input = normalizeTransactionInput(paidBoleto);

  assert.equal(input.dueDate, "2026-09-03");
  assert.equal(input.boletoPaymentDate, "2026-08-20");
  assert.equal(validateTransactionForm({ value: paidBoleto }), undefined);
});

test("non-card expense forms retain optional due dates for payables, installments and recurring rules", () => {
  for (const paymentMethod of ["pix", "debit_card", "cash", "bank_transfer", "benefits"] as const) {
    for (const condition of ["single", "installment", "recurring"] as const) {
      const values: TransactionFormValues = {
        ...paidBoleto,
        paymentMethod,
        condition,
        isSettled: "false",
        boletoPaymentDate: "",
      };
      assert.equal(validateTransactionForm({ value: values }), undefined);
      assert.equal(normalizeTransactionInput(values).dueDate, "2026-09-03");
      assert.equal(normalizeTransactionInput({ ...values, dueDate: "" }).dueDate, null);
    }
  }
  assert.equal(
    normalizeTransactionInput({
      ...paidBoleto,
      paymentMethod: "credit_card",
      cardId: paidBoleto.accountId,
    }).dueDate,
    null,
  );
});

test("paid boleto form requires the effective payment date", () => {
  const validation = validateTransactionForm({
    value: { ...paidBoleto, boletoPaymentDate: "" },
  });

  assert.equal(validation?.fields.boletoPaymentDate, "Informe uma data de pagamento válida.");
});

test("new card purchases and transfers start pending unless a caller provides another default", () => {
  assert.equal(getDefaultTransactionFormValues([], [], [], "expense").isSettled, "false");
  assert.equal(getDefaultTransactionFormValues([], [], [], "income").isSettled, "false");
  assert.equal(getDefaultTransactionFormValues([], [], [], "transfer").isSettled, "false");
  assert.equal(
    getDefaultTransactionFormValues([], [], [], "expense", undefined, { isSettled: "true" })
      .isSettled,
    "true",
  );
});

test("new transactions outside the credit card start settled today", () => {
  const values = getDefaultTransactionFormValues([], [], [], "expense", undefined, {
    paymentMethod: "pix",
  });
  assert.equal(values.isSettled, "true");
  assert.equal(values.boletoPaymentDate, getCurrentDateInBrazil());
  assert.equal(
    getDefaultTransactionFormValues([], [], [], "expense", undefined, {
      paymentMethod: "boleto",
      isSettled: "false",
    }).boletoPaymentDate,
    "",
  );
  assert.equal(isSettledByDefault("income", "debit_card"), true);
  assert.equal(isSettledByDefault("expense", "credit_card"), false);
  assert.equal(isSettledByDefault("transfer", "bank_transfer"), false);
});

test("tag edits preserve unchanged scopes and send explicit removals", () => {
  const tagId = "40000000-0000-4000-8000-000000000004";
  const defaults = { ...paidBoleto, tagIds: [tagId] };
  const renamed = { ...defaults, name: "Conta renomeada" };
  const renamedInput = normalizeTransactionInput(renamed);
  assert.deepEqual(renamedInput.tagIds, [tagId]);
  assert.equal(getChangedTransactionInput(renamedInput, renamed, defaults).tagIds, undefined);
  const removed = { ...defaults, tagIds: [] };
  assert.deepEqual(
    getChangedTransactionInput(normalizeTransactionInput(removed), removed, defaults).tagIds,
    [],
  );
  assert.equal(
    validateTransactionForm({ value: { ...defaults, tagIds: [tagId, tagId] } })?.fields.tagIds,
    "Selecione até 20 etiquetas.",
  );
});
