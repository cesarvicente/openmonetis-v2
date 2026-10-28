import assert from "node:assert/strict";
import test from "node:test";
import { type CommitmentsRepository, createCommitmentsService } from "./commitments.service";

test("commitments service scopes every read to the user and the requested horizon", async () => {
  const calls: unknown[][] = [];
  const repository: CommitmentsRepository = {
    async listInstallmentRowsForUser(userId) {
      calls.push(["installments", userId]);
      return [];
    },
    async listRecurringRulesForUser(userId, periodEnd) {
      calls.push(["recurring", userId, periodEnd.toISOString().slice(0, 10)]);
      return [];
    },
    async listSingleEntriesForUser(userId, startPeriod, endPeriod) {
      calls.push(["single", userId, startPeriod, endPeriod]);
      return [{ period: "2026-11", type: "expense", origin: "regular", amount: "80" }];
    },
  };

  const report = await createCommitmentsService(repository).list("user-1", {
    startPeriod: "2026-10",
    endPeriod: "2026-12",
  });

  assert.deepEqual(calls.sort(), [
    ["installments", "user-1"],
    ["recurring", "user-1", "2026-12-31"],
    ["single", "user-1", "2026-10", "2026-12"],
  ]);
  assert.deepEqual(
    report.months.map((month) => [month.period, month.billsAmount]),
    [
      ["2026-10", 0],
      ["2026-11", 80],
      ["2026-12", 0],
    ],
  );
});
