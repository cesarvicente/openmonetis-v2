import assert from "node:assert/strict";
import test from "node:test";
import { SettlementError } from "@openmonetis/domain/settlements";
import { type BillsRepository, createBillsService } from "./bills.service";

const owner = "owner";
const account = { id: "account", name: "Checking", logo: null };
function fixture() {
  const persisted: Awaited<ReturnType<BillsRepository["listPersisted"]>> = [
    {
      id: "bill",
      purchaseDate: "2020-01-10",
      name: "Electricity",
      amount: "-10.01",
      dueDate: "2020-01-10",
      boletoPaymentDate: null,
      settledDate: null,
      isSettled: false,
      condition: "single",
      currentInstallment: null,
      installmentCount: null,
      paymentMethod: "pix",
      accountId: account.id,
      accountName: account.name,
      accountLogo: null,
      categoryName: "Home",
      categoryIcon: null,
      personId: "person",
      personName: "Owner",
      personAvatarUrl: null,
      splits: [],
    },
  ];
  const recurring: Awaited<ReturnType<BillsRepository["listRecurring"]>> = [];
  const states: Awaited<ReturnType<BillsRepository["listOccurrenceStates"]>> = [];
  const payments: unknown[][] = [];
  const repository: BillsRepository = {
    async listPersisted(userId) {
      assert.equal(userId, owner);
      return persisted;
    },
    async listRecurring(userId) {
      assert.equal(userId, owner);
      return recurring;
    },
    async listOccurrenceStates(userId) {
      assert.equal(userId, owner);
      return states;
    },
    async listAccounts(userId) {
      assert.equal(userId, owner);
      return [account];
    },
    async payPersisted(...args) {
      payments.push(args);
      return true;
    },
    async payRecurring(...args) {
      payments.push(args);
      return true;
    },
  };
  return {
    persisted,
    recurring,
    states,
    payments,
    repository,
    service: createBillsService(repository, () => "2020-01-20"),
  };
}

test("bills exclude paid amounts from open totals and preserve settlement dates", async () => {
  const f = fixture();
  f.persisted.push({
    ...f.persisted[0],
    id: "paid",
    amount: "-20.02",
    isSettled: true,
    settledDate: "2020-01-08",
    frozenDueDate: "2020-01-10",
  });
  const result = await f.service.get("2020-01", owner);
  assert.equal(result.totalOpen, 10.01);
  assert.equal(result.overdueCount, 1);
  assert.deepEqual(
    result.items.map((item) => [item.id, item.status]),
    [
      ["bill", "overdue"],
      ["paid", "paid"],
    ],
  );
  assert.equal(result.items[1].settledDate, "2020-01-08");
  assert.deepEqual(
    result.items[0].people.map((p) => p.amount),
    [10.01],
  );
});

test("adjusted month boundaries move unpaid bills while frozen paid dates stay in history", async () => {
  const f = fixture();
  f.persisted[0].dueDate = "2021-01-31";
  const service = createBillsService(f.repository, () => "2021-02-05");
  assert.equal((await service.get("2021-01", owner)).items.length, 0);
  const moved = await service.get("2021-02", owner);
  assert.equal(moved.items[0].dueDate, "2021-02-01");
  assert.equal(moved.items[0].originalDueDate, "2021-01-31");
  assert.equal((await service.get("2021-01", owner, true)).items.length, 1);
  f.persisted[0].isSettled = true;
  f.persisted[0].frozenDueDate = "2021-01-31";
  assert.equal((await service.get("2021-01", owner)).items[0].dueDate, "2021-01-31");
});

test("a recurring settlement changes only its occurrence, amount, allocations and payment account", async () => {
  const f = fixture();
  f.persisted.length = 0;
  f.recurring.push({
    id: "rule",
    seriesId: "series",
    anchorDate: "2020-01-10",
    startDate: "2020-01-10",
    dueDate: "2020-01-10",
    frequency: "monthly",
    name: "Rent",
    amount: "-100.00",
    isSettled: false,
    paymentMethod: "pix",
    accountId: "old",
    accountName: "Old account",
    accountLogo: null,
    categoryName: "Home",
    categoryIcon: null,
    personId: "person",
    personName: "Owner",
    personAvatarUrl: null,
    splits: [
      { personId: "person", personName: "Owner", personAvatarUrl: null, amount: "-60.00" },
      { personId: "guest", personName: "Guest", personAvatarUrl: null, amount: "-40.00" },
    ],
    occurrenceOverrides: {
      "2020-01-10": {
        isSettled: true,
        amount: "-90.01",
        allocations: [
          { personId: "person", amount: "-54.01" },
          { personId: "guest", amount: "-36.00" },
        ],
      },
    },
  });
  f.states.push({
    recurringSeriesId: "series",
    purchaseDate: "2020-01-10",
    isSettled: true,
    accountId: account.id,
    boletoPaymentDate: null,
    settledDate: "2020-01-15",
  });
  const january = await f.service.get("2020-01", owner);
  assert.equal(january.totalOpen, 0);
  assert.equal(january.items[0].amount, 90.01);
  assert.equal(january.items[0].accountName, "Checking");
  assert.deepEqual(
    january.items[0].people.map((p) => p.amount),
    [36, 54.01],
  );
  const february = await f.service.get("2020-02", owner);
  assert.equal(february.totalOpen, 100);
  assert.equal(february.items[0].isSettled, false);
  assert.equal(february.items[0].accountId, "old");
  await f.service.pay(
    "2020-02",
    { billId: february.items[0].id, accountId: account.id, paidAt: "2020-01-20", amount: 95 },
    owner,
  );
  assert.deepEqual(f.payments, [[owner, "rule", "2020-02-10", account.id, "2020-01-20", 95]]);
});

for (const scenario of ["future", "foreign account", "missing bill", "already paid"] as const) {
  test(`bill payment rejects ${scenario} without writing`, async () => {
    const f = fixture();
    if (scenario === "already paid") f.persisted[0].isSettled = true;
    await assert.rejects(
      f.service.pay(
        "2020-01",
        {
          billId: scenario === "missing bill" ? "foreign" : "bill",
          accountId: scenario === "foreign account" ? "foreign" : account.id,
          paidAt: scenario === "future" ? "2020-01-21" : "2020-01-20",
        },
        owner,
      ),
      {
        code:
          scenario === "future"
            ? "bill_payment_date_future"
            : scenario === "foreign account"
              ? "account_not_found"
              : "bill_not_found",
      },
    );
    assert.deepEqual(f.payments, []);
  });
}

test("bill payment forwards actual amount and translates concurrent rejection and domain errors", async () => {
  const f = fixture();
  const input = { billId: "bill", accountId: account.id, paidAt: "2020-01-20", amount: 9.99 };
  await f.service.pay("2020-01", input, owner);
  assert.deepEqual(f.payments, [[owner, "bill", account.id, "2020-01-20", 9.99]]);
  f.repository.payPersisted = async () => false;
  await assert.rejects(f.service.pay("2020-01", input, owner), { code: "bill_not_found" });
  f.repository.payPersisted = async () => {
    throw new SettlementError("INVALID_SETTLEMENT_AMOUNT");
  };
  await assert.rejects(f.service.pay("2020-01", input, owner), {
    status: 400,
    code: "INVALID_SETTLEMENT_AMOUNT",
  });
  const failure = new Error("Database unavailable");
  f.repository.payPersisted = async () => {
    throw failure;
  };
  await assert.rejects(f.service.pay("2020-01", input, owner), (error) => error === failure);
});
