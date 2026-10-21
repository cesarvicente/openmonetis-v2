import assert from "node:assert/strict";
import test from "node:test";
import { type DueDateRuleVersion, defaultDueDateRules } from "@openmonetis/domain/due-date-rules";
import { createDueDateRulesService, type DueDateRulesRepository } from "./due-date-rules.service";

const rule = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Boletos",
  target: "payable" as const,
  scope: "all" as const,
  cardIds: [],
  transactionIds: [],
  seriesIds: [],
  adjustment: "next" as const,
  weekends: true,
  holidays: true,
};
function setup() {
  const rows = new Map<string, DueDateRuleVersion[]>();
  const repository: DueDateRulesRepository = {
    setException: async () => false,
    listVersions: async (userId) => rows.get(userId) ?? [],
    listTargets: async () => ({
      cards: [{ id: "card", name: "Cartão" }],
      transactions: [{ id: "boleto", name: "Conta" }],
      recurringSeries: [],
    }),
    appendVersion: async (userId, input) => {
      const current = rows.get(userId) ?? [];
      if ((current.at(-1)?.revision ?? 0) !== input.revision) return null;
      const saved = { ...input, revision: input.revision + 1 };
      rows.set(userId, [...current, saved]);
      return saved;
    },
  };
  const service = createDueDateRulesService(
    repository,
    async () => [
      {
        id: "boleto",
        name: "Conta",
        type: "expense",
        paymentMethod: "boleto",
        target: "payable",
        dueDate: "2026-10-31",
        currentDueDate: "2026-11-03",
      },
    ],
    () => "2026-10-12",
  );
  return { service, repository, rows };
}
test("rules are isolated per user and saving appends an immutable revision", async () => {
  const { service, rows } = setup();
  const input = { ...defaultDueDateRules("2026-10-12"), rules: [rule] };
  const saved = await service.save(input, "owner");
  assert.equal(saved.revision, 1);
  assert.equal((await service.get("other")).rules.length, 0);
  await service.save({ ...saved, effectiveFrom: "2026-11-01", rules: [] }, "owner");
  assert.equal(rows.get("owner")?.[0].rules.length, 1);
  assert.equal(rows.get("owner")?.length, 2);
  await assert.rejects(service.save(saved, "owner"), { code: "DUE_DATE_RULES_STALE" });
});
test("preview shows changed dates and does not persist the draft", async () => {
  const { service, rows } = setup();
  const preview = await service.preview(
    { ...defaultDueDateRules("2026-10-12"), rules: [{ ...rule, adjustment: "previous" }] },
    "owner",
  );
  assert.equal(preview.items[0].dueDate, "2026-10-30");
  assert.equal(preview.items[0].originalDueDate, "2026-10-31");
  assert.equal(rows.size, 0);
});
test("foreign targets, past effective dates and conflicting targets are rejected", async () => {
  const { service } = setup();
  const input = { ...defaultDueDateRules("2026-10-12"), rules: [rule] };
  await assert.rejects(
    service.save(
      { ...input, rules: [{ ...rule, scope: "selected", transactionIds: ["foreign"] }] },
      "owner",
    ),
    { code: "DUE_DATE_RULE_TARGET_UNAVAILABLE" },
  );
  await assert.rejects(service.save({ ...input, effectiveFrom: "2026-10-11" }, "owner"), {
    code: "DUE_DATE_RULES_EFFECTIVE_DATE",
  });
  await assert.rejects(
    service.save({ ...input, rules: [rule, { ...rule, id: "another" }] }, "owner"),
    { code: "DUE_DATE_RULE_CONFLICT" },
  );
});

test("preview and save default the effective date to today on the server", async () => {
  const { service } = setup();
  const { SaveDueDateRulesInputSchema, DueDateRulesOutputSchema } = await import(
    "@openmonetis/validators/due-date-rules"
  );
  const input = SaveDueDateRulesInputSchema.parse({
    revision: 0,
    calendar: defaultDueDateRules("2026-10-12").calendar,
    rules: [rule],
  });
  const preview = await service.preview(input, "owner");
  assert.equal(preview.from, "2026-10-12");
  assert.equal(preview.items.length, 0);
  const saved = DueDateRulesOutputSchema.parse(await service.save(input, "owner"));
  assert.equal(saved.effectiveFrom, preview.from);
  const scheduled = await service.save(
    { ...saved, effectiveFrom: "2026-12-01", rules: [] },
    "owner",
  );
  const immediate = await service.save({ ...input, revision: scheduled.revision }, "owner");
  assert.equal(immediate.effectiveFrom, "2026-10-12");
});

test("holiday endpoint publishes the calendar and validates the requested year", async () => {
  const { service } = setup();
  const { createDueDateRulesRoute } = await import("../routes/due-date-rules");
  const app = createDueDateRulesRoute(service);
  const result = await app.request("/holidays?year=2026");
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.data.items.length, 9);
  assert.deepEqual(
    body.data.items.find((holiday: { id: string }) => holiday.id === "christmas"),
    { id: "christmas", date: "2026-12-25" },
  );
  assert.equal((await app.request("/holidays?year=bad")).status, 400);
  assert.equal((await app.request("/holidays?year=9999")).status, 400);
});

test("exception route validates targets and translates domain guards without exposing ownership", async () => {
  const { service, repository } = setup();
  const { createDueDateRulesRoute } = await import("../routes/due-date-rules");
  const app = createDueDateRulesRoute(service);
  app.use("*", async (c, next) => {
    c.set("userId", "owner");
    await next();
  });
  const request = (input: unknown) =>
    app.request("/exception", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  assert.equal(
    (await request({ target: "invoice", cardId: "bad", period: "2026-13", excluded: true })).status,
    400,
  );
  const input = { target: "transaction" as const, transactionId: rule.id, excluded: true };
  await assert.rejects(service.setException(input, "owner"), {
    code: "DUE_DATE_RULE_TARGET_UNAVAILABLE",
  });
  repository.setException = async (userId, _input, guard) => {
    assert.equal(userId, "owner");
    guard({
      target: "transaction",
      type: "expense",
      paymentMethod: "boleto",
      dueDate: "2026-10-31",
      isSettled: true,
    });
    return true;
  };
  await assert.rejects(service.setException(input, "owner"), {
    code: "DUE_DATE_EXCEPTION_SETTLED",
  });
  repository.setException = async () => true;
  assert.deepEqual(await service.setException(input, "owner"), { excluded: true });
});
