import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateReimbursementSurplus,
  calculateReimbursementShares,
  canChangeReimbursementDueDate,
  createReimbursementName,
  type ExistingReimbursement,
  isCountedTransaction,
  planReimbursementSync,
  type ReimbursementTarget,
  resolveReimbursementDueDate,
  summarizeReceivablesByPerson,
} from "./reimbursements";

const admin = { personId: "admin", role: "admin" as const };
const ket = { personId: "ket", role: "external" as const };

const target: ReimbursementTarget = {
  sourceKey: "expense",
  personId: "ket",
  name: "Reembolso - Jantar",
  amount: 100,
  purchaseDate: "2026-12-16",
  period: "2026-12",
  expensePeriod: "2026-12",
  expenseDueDate: "2026-12-16",
  dueDate: "2026-12-16",
  accountId: "account",
  isGuaranteed: false,
};

const existing: ExistingReimbursement = {
  ...target,
  id: "reimbursement",
  receivedAmount: 0,
  isSettled: false,
  isCustomized: false,
};

test("the name follows the expense and fits the column", () => {
  assert.equal(createReimbursementName("Jantar"), "Reembolso - Jantar");
  assert.equal(createReimbursementName("x".repeat(200)).length, 160);
});

test("other people owe the whole expense or only their share of it", () => {
  assert.deepEqual(calculateReimbursementShares({ amount: "-200.00", owner: ket, splits: [] }), [
    { personId: "ket", amount: 200 },
  ]);
  assert.deepEqual(
    calculateReimbursementShares({ amount: "-200.00", owner: admin, splits: [] }),
    [],
  );
  assert.deepEqual(
    calculateReimbursementShares({
      amount: "-200.00",
      owner: admin,
      splits: [
        { ...admin, amount: "-120.00" },
        { ...ket, amount: "-80.00" },
      ],
    }),
    [{ personId: "ket", amount: 80 }],
  );
});

test("a store refund reduces what each person owes", () => {
  assert.deepEqual(
    calculateReimbursementShares({
      amount: "-200.00",
      owner: admin,
      splits: [
        { ...admin, amount: "-100.00" },
        { ...ket, amount: "-100.00" },
      ],
      refundedAmount: "50.00",
    }),
    [{ personId: "ket", amount: 75 }],
  );
  assert.deepEqual(
    calculateReimbursementShares({ amount: 50, owner: ket, splits: [], refundedAmount: 50 }),
    [],
  );
});

test("the date follows the expense until it is overdue", () => {
  assert.equal(
    resolveReimbursementDueDate({
      promisedDate: null,
      expenseDueDate: "2026-11-16",
      purchaseDate: "2026-10-30",
    }),
    "2026-11-16",
  );
  assert.equal(
    resolveReimbursementDueDate({
      promisedDate: "2026-12-05",
      expenseDueDate: "2026-11-16",
      purchaseDate: "2026-10-30",
    }),
    "2026-12-05",
  );
  const today = "2026-11-23";
  const canChange = (expenseDueDate: string | null, isSettled = false) =>
    canChangeReimbursementDueDate({ expenseDueDate, today, isSettled });
  assert.equal(canChange("2026-11-16"), true);
  assert.equal(canChange("2026-12-16"), false);
  assert.equal(canChange(null), true);
  assert.equal(canChange("2026-11-16", true), false);
});

test("the sync creates, follows and removes pending reimbursements", () => {
  assert.deepEqual(planReimbursementSync([target], []).inserts, [target]);
  assert.deepEqual(planReimbursementSync([target], [existing]), {
    inserts: [],
    updates: [],
    deletes: [],
  });
  const changed = planReimbursementSync([{ ...target, amount: 150, name: "Outro" }], [existing]);
  assert.equal(changed.updates[0]?.changes.amount, 150);
  assert.equal(changed.updates[0]?.changes.name, "Outro");
  assert.deepEqual(planReimbursementSync([], [existing]).deletes, ["reimbursement"]);
});

test("what was received is never rewritten nor removed", () => {
  const settled = { ...existing, isSettled: true };
  assert.deepEqual(planReimbursementSync([{ ...target, amount: 500 }], [settled]).updates, []);
  assert.deepEqual(planReimbursementSync([], [settled]).deletes, []);
  const partial = { ...existing, amount: 60, receivedAmount: 40 };
  assert.deepEqual(planReimbursementSync([], [partial]).deletes, []);
  assert.deepEqual(planReimbursementSync([target], [partial]).updates, []);
  assert.equal(
    planReimbursementSync([{ ...target, amount: 120 }], [partial]).updates[0]?.changes.amount,
    80,
  );
});

test("a customized reimbursement keeps its own date and guarantee", () => {
  const customized = {
    ...existing,
    isCustomized: true,
    isGuaranteed: true,
    dueDate: "2027-01-05",
    purchaseDate: "2027-01-05",
    period: "2027-01",
  };
  assert.deepEqual(planReimbursementSync([target], [customized]).updates, []);
});

test("money from someone else only counts when received or guaranteed", () => {
  const counted = (overrides: Partial<Parameters<typeof isCountedTransaction>[0]>) =>
    isCountedTransaction({
      type: "income",
      origin: "reimbursement",
      personRole: "external",
      isSettled: false,
      isGuaranteed: false,
      ...overrides,
    });
  assert.equal(counted({}), false);
  assert.equal(counted({ isGuaranteed: true }), true);
  assert.equal(counted({ isSettled: true }), true);
  assert.equal(counted({ origin: "regular" }), false);
  assert.equal(counted({ personRole: "admin" }), true);
  assert.equal(counted({ type: "expense" }), true);
  assert.equal(counted({ origin: "refund" }), true);
});

test("the surplus pays the next ones in order and the rest becomes income", () => {
  assert.deepEqual(allocateReimbursementSurplus(42, [758], "next"), {
    allocations: [42],
    incomeAmount: 0,
  });
  assert.deepEqual(allocateReimbursementSurplus(150.01, [100, 30], "next"), {
    allocations: [100, 30],
    incomeAmount: 20.01,
  });
  assert.deepEqual(allocateReimbursementSurplus(42, [758], "income"), {
    allocations: [],
    incomeAmount: 42,
  });
});

test("each person's summary separates overdue, due, upcoming, partial and received", () => {
  const entry = {
    personId: "ket",
    personName: "Ket",
    personAvatarUrl: null,
    personStatus: "active" as const,
    period: "2026-11",
    isSettled: false,
    settledDate: null,
    isPartial: false,
  };
  const summary = summarizeReceivablesByPerson(
    [
      { ...entry, amount: 1350, expectedDate: "2026-11-16" },
      {
        ...entry,
        amount: 500,
        expectedDate: "2026-11-16",
        isSettled: true,
        settledDate: "2026-11-20",
        isPartial: true,
      },
      { ...entry, amount: 40, expectedDate: "2026-11-30" },
      { ...entry, amount: 1850, period: "2026-12", expectedDate: "2026-12-16" },
      { ...entry, personId: "pai", personName: "Pai", amount: 10, expectedDate: "2026-11-30" },
    ],
    "2026-11",
    "2026-11-23",
  );
  assert.deepEqual(summary.items[0], {
    personId: "ket",
    personName: "Ket",
    personAvatarUrl: null,
    personStatus: "active",
    overdueCount: 1,
    pendingAmount: 3240,
    overdueAmount: 1350,
    dueAmount: 40,
    upcomingAmount: 1850,
    partialAmount: 500,
    receivedAmount: 500,
  });
  assert.equal(summary.pendingAmount, 3250);
  assert.equal(summary.overdueAmount, 1350);
});
