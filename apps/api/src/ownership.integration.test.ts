import assert from "node:assert/strict";
import test from "node:test";
import { createTestApiClient } from "./test-support/api-client";
import { withIntegrationDatabase } from "./test-support/integration-database";

test("authenticated users cannot read or mutate foreign financial resources", {
  skip: process.env.OWNERSHIP_INTEGRATION_TEST !== "1",
}, async (t) => {
  await withIntegrationDatabase(async () => {
    const api = await createTestApiClient();
    const owner = await api.register();
    const stranger = await api.register();
    const account = await api.account(owner);
    const resources = [
      { path: "/accounts", id: account.id, method: "PATCH", patch: { name: "Stolen" } },
      {
        path: "/cards",
        input: {
          accountId: account.id,
          name: "Card",
          brand: "visa",
          closingDay: 20,
          dueDay: 25,
          limit: 1000,
        },
        method: "PATCH",
        patch: { name: "Stolen" },
      },
      { path: "/people", input: { name: "Guest" }, method: "PATCH", patch: { name: "Stolen" } },
      {
        path: "/categories",
        input: { name: "Owned", type: "expense" },
        method: "PATCH",
        patch: { name: "Stolen" },
      },
      { path: "/tags", input: { name: "Owned" }, method: "PATCH", patch: { name: "Stolen" } },
      {
        path: "/budgets",
        input: { categoryId: owner.expenseCategoryId, period: "2020-01", amount: 100 },
        method: "PATCH",
        patch: { amount: 1 },
      },
      {
        path: "/goals",
        input: {
          name: "Reserve",
          trackingType: "manual",
          targetAmount: 100,
          currentAmount: 10,
          targetDate: null,
        },
        method: "PATCH",
        patch: { name: "Stolen" },
      },
      {
        path: "/notes",
        input: { title: "Owned", kind: "text", content: "Private" },
        method: "PUT",
        patch: { expectedVersion: 1, title: "Stolen", kind: "text", content: "Changed" },
      },
    ];
    for (const resource of resources)
      await t.test(
        `${resource.path} rejects foreign writes and keeps the original resource`,
        async () => {
          const record = resource.id
            ? { id: resource.id }
            : await api.data<{ id: string }>(
                await api.request(resource.path, owner, "POST", resource.input),
                201,
              );
          const path = `${resource.path}/${record.id}`;
          const before = await api.request(path, owner);
          const beforeText = before.status === 200 ? await before.text() : null;
          if (beforeText) await api.error(await api.request(path, stranger), 404);
          await api.error(await api.request(path, stranger, resource.method, resource.patch), 404);
          await api.error(
            await api.request(
              resource.path === "/notes" ? `${path}?expectedVersion=1` : path,
              stranger,
              "DELETE",
            ),
            404,
          );
          if (beforeText) assert.equal(await (await api.request(path, owner)).text(), beforeText);
        },
      );
    await t.test(
      "foreign accounts and categories cannot be linked to cards, goals or budgets",
      async () => {
        await api.error(
          await api.request("/cards", stranger, "POST", {
            accountId: account.id,
            name: "Card",
            brand: "visa",
            closingDay: 20,
            dueDay: 25,
            limit: 100,
          }),
          404,
        );
        await api.error(
          await api.request("/goals", stranger, "POST", {
            name: "Reserve",
            trackingType: "account",
            accountId: account.id,
            targetAmount: 100,
            targetDate: null,
          }),
          404,
        );
        await api.error(
          await api.request("/budgets", stranger, "POST", {
            categoryId: owner.expenseCategoryId,
            period: "2020-01",
            amount: 10,
          }),
          404,
        );
      },
    );
  });
});
