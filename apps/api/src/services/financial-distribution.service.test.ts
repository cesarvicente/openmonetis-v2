import assert from "node:assert/strict";
import test from "node:test";
import {
  FinancialDistributionOutputSchema,
  ListFinancialDistributionQuerySchema,
} from "@openmonetis/validators/financial-distribution";
import { createFinancialDistributionRoute } from "../routes/financial-distribution";
import { createFinancialDistributionService } from "./financial-distribution.service";

for (const personScope of ["admin", "all", "80000000-0000-4000-8000-000000000008"]) {
  test(`distribution forwards the authenticated owner and ${personScope} scope to both entry sources`, async () => {
    const calls: unknown[][] = [];
    const service = createFinancialDistributionService({
      async listCategoriesForUser(userId) {
        assert.equal(userId, "owner");
        return [];
      },
      async listActualEntriesForUser(...args) {
        calls.push(args);
        return [];
      },
      async listRecurringRulesForUser(...args) {
        calls.push(args);
        return [];
      },
    });
    const report = await service.list(
      "owner",
      ListFinancialDistributionQuerySchema.parse({ period: "2026-10", personScope }),
    );
    assert.equal(report.mode, "actual");
    assert.equal(FinancialDistributionOutputSchema.safeParse(report).success, true);
    for (const args of calls) {
      assert.equal(args[0], "owner");
      assert.equal(args.at(-1), personScope);
    }
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.[1], "2026-09");
    assert.equal(calls[0]?.[2], "2026-10");
  });
}

test("distribution rejects invalid period, composition and person scope before the service", async () => {
  let called = false;
  const route = createFinancialDistributionRoute({
    async list() {
      called = true;
      throw new Error("Unexpected service call");
    },
  });
  for (const query of [
    "period=2026-13",
    "period=2026-10&mode=paid",
    "period=2026-10&personScope=external",
    "",
  ]) {
    assert.equal((await route.request(`http://localhost/?${query}`)).status, 400);
  }
  assert.equal(called, false);
});
