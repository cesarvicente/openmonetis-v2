import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { DeleteSettingsAccountInputSchema, ResetSettingsInputSchema } from "./settings";

test("dangerous actions require their own exact confirmation and cannot target a supplied user ID", () => {
  for (const [schema, confirmation] of [
    [ResetSettingsInputSchema, "ZERAR"],
    [DeleteSettingsAccountInputSchema, "EXCLUIR"],
  ] as const) {
    assert.equal(schema.safeParse({ confirmation }).success, true);
    for (const value of [confirmation.toLowerCase(), ` ${confirmation}`, "invalid"])
      assert.equal(schema.safeParse({ confirmation: value }).success, false);
    assert.equal(schema.safeParse({ confirmation, userId: randomUUID() }).success, false);
  }
});
