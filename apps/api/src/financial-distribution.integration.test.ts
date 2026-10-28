import assert from "node:assert/strict";
import test from "node:test";
import {
  type FinancialDistributionOutput,
  FinancialDistributionOutputSchema,
} from "@openmonetis/validators/financial-distribution";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { createTestApiClient } from "./test-support/api-client";
import { withIntegrationDatabase } from "./test-support/integration-database";

test("financial distribution isolates ownership, honors splits and settlements, and expands forecasts once", {
  skip: process.env.FINANCIAL_DISTRIBUTION_INTEGRATION_TEST !== "1",
}, async () => {
  await withIntegrationDatabase(async () => {
    const api = await createTestApiClient();
    const owner = await api.register();
    const stranger = await api.register();
    const account = await api.account(owner);
    const guest = await api.data<{ id: string }>(
      await api.request("/people", owner, "POST", { name: "Guest" }),
      201,
    );
    const reportPath = "/reports/financial-distribution?period=2020-01";
    await api.error(await api.request(reportPath), 401);
    await api.error(await api.request(`${reportPath}&mode=paid`, owner), 400);
    await api.expense(owner, {
      amount: 100,
      accountId: account.id,
      splitShares: [
        { personId: owner.personId, amount: 60 },
        { personId: guest.id, amount: 40 },
      ],
    });
    const adjusted = await api.expense(owner, { amount: 50, accountId: account.id });
    await api.data(
      await api.request("/transactions/settlement", owner, "PATCH", {
        ids: [adjusted.id],
        isSettled: true,
        settledAmount: 45,
        settledDate: "2020-01-10",
      }),
    );
    await api.expense(owner, {
      type: "income",
      amount: 200,
      categoryId: owner.incomeCategoryId,
      accountId: account.id,
    });
    const recurrence = await api.data<TransactionOutput>(
      await api.request("/transactions", owner, "POST", {
        type: "expense",
        condition: "recurring",
        recurrenceFrequency: "monthly",
        name: "Recurring",
        amount: 20,
        purchaseDate: "2020-01-15",
        paymentMethod: "pix",
        personId: owner.personId,
        categoryId: owner.expenseCategoryId,
        accountId: account.id,
      }),
      201,
    );
    const read = async (scope = "admin", mode = "actual", identity = owner) => {
      const report = await api.data<FinancialDistributionOutput>(
        await api.request(`${reportPath}&personScope=${scope}&mode=${mode}`, identity),
      );
      assert.equal(FinancialDistributionOutputSchema.safeParse(report).success, true);
      return report;
    };
    assert.equal((await read()).expenseAmount, 105);
    assert.equal((await read("all")).expenseAmount, 145);
    assert.equal((await read(guest.id)).expenseAmount, 40);
    assert.equal((await read("admin", "forecast")).expenseAmount, 125);
    assert.equal((await read("all", "forecast")).expenseAmount, 165);
    assert.equal((await read("all", "forecast", stranger)).incomeAmount, 0);
    assert.equal((await read("all", "forecast", stranger)).expenseAmount, 0);
    assert.equal((await read(stranger.personId)).flowAmount, 0);
    assert.ok(recurrence.recurringRuleId);
    await api.data(
      await api.request("/transactions/recurring-occurrences/settlement", owner, "PATCH", {
        recurringRuleId: recurrence.recurringRuleId,
        purchaseDate: "2020-01-15",
        isSettled: true,
        settledAmount: 18,
        settledDate: "2020-01-15",
        accountId: account.id,
      }),
    );
    assert.equal((await read()).expenseAmount, 123);
    assert.equal((await read("admin", "forecast")).expenseAmount, 123);
    const { db, transactions } = await import("@openmonetis/db");
    const { and, eq } = await import("drizzle-orm");
    await db
      .update(transactions)
      .set({ categoryId: null })
      .where(and(eq(transactions.id, adjusted.id), eq(transactions.userId, owner.id)));
    const uncategorized = await read();
    assert.equal(
      uncategorized.categories.find((category) => category.key === "uncategorized-expense")?.amount,
      45,
    );
    assert.equal(uncategorized.expenseAmount, 123);

    const hiddenAccount = await api.data<{ id: string }>(
      await api.request("/accounts", owner, "POST", {
        name: "Hidden investment",
        type: "investment",
        excludeFromBalance: true,
      }),
      201,
    );
    const createHidden = async (overrides: Record<string, unknown>) =>
      api.data<TransactionOutput>(
        await api.request("/transactions", owner, "POST", {
          name: "Hidden posting",
          type: "income",
          paymentMethod: "pix",
          amount: 30,
          personId: owner.personId,
          categoryId: owner.incomeCategoryId,
          accountId: hiddenAccount.id,
          purchaseDate: "2020-01-15",
          ...overrides,
        }),
        201,
      );
    await api.data(
      await api.request(`/accounts/${hiddenAccount.id}/yields`, owner, "POST", {
        mode: "amount",
        amount: 30,
        date: "2020-01-15",
      }),
    );
    await createHidden({ type: "expense", categoryId: owner.expenseCategoryId, amount: 7 });
    const hiddenIncomeRule = await createHidden({
      condition: "recurring",
      recurrenceFrequency: "monthly",
      amount: 9,
    });
    await createHidden({
      type: "expense",
      categoryId: owner.expenseCategoryId,
      amount: 11,
      condition: "recurring",
      recurrenceFrequency: "monthly",
    });
    const hiddenCard = await api.data<{ id: string }>(
      await api.request("/cards", owner, "POST", {
        name: "Hidden card",
        accountId: hiddenAccount.id,
        brand: "visa",
        closingDay: 20,
        dueDay: 25,
        limit: 1000,
      }),
      201,
    );
    await createHidden({
      type: "expense",
      categoryId: owner.expenseCategoryId,
      paymentMethod: "credit_card",
      cardId: hiddenCard.id,
      accountId: null,
      amount: 17,
      invoicePeriod: "2020-01",
    });
    for (const mode of ["actual", "forecast"]) {
      const report = await read("admin", mode);
      assert.equal(report.incomeAmount, 200);
      assert.equal(report.expenseAmount, 123);
      assert.equal(report.balanceAmount, 77);
      assert.equal((await read("all", mode)).expenseAmount, 163);
    }
    assert.ok(hiddenIncomeRule.recurringRuleId);
    await api.data(
      await api.request("/transactions/recurring-occurrences/settlement", owner, "PATCH", {
        recurringRuleId: hiddenIncomeRule.recurringRuleId,
        purchaseDate: "2020-01-15",
        isSettled: true,
        settledAmount: 8,
        settledDate: "2020-01-15",
        accountId: account.id,
      }),
    );
    for (const mode of ["actual", "forecast"])
      assert.equal((await read("admin", mode)).incomeAmount, 208);
    await api.data(
      await api.request("/transactions/recurring-occurrences/settlement", owner, "PATCH", {
        recurringRuleId: recurrence.recurringRuleId,
        purchaseDate: "2020-01-15",
        isSettled: false,
      }),
    );
    await api.data(
      await api.request("/transactions/recurring-occurrences/settlement", owner, "PATCH", {
        recurringRuleId: recurrence.recurringRuleId,
        purchaseDate: "2020-01-15",
        isSettled: true,
        settledAmount: 18,
        settledDate: "2020-01-15",
        accountId: hiddenAccount.id,
      }),
    );
    for (const mode of ["actual", "forecast"])
      assert.equal((await read("admin", mode)).expenseAmount, 105);
    await api.data(
      await api.request(`/accounts/${hiddenAccount.id}`, owner, "PATCH", {
        excludeFromBalance: false,
      }),
    );
    assert.equal((await read()).incomeAmount, 238);
    assert.equal((await read()).expenseAmount, 147);
    assert.equal((await read("admin", "forecast")).expenseAmount, 158);
    const specResponse = await api.app.request("http://localhost:7001/openapi.json");
    if (specResponse.ok) assert.match(await specResponse.text(), /reports\/financial-distribution/);
  });
});
