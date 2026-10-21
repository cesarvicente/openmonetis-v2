import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  ClaimPersonConnectionInvitationInputSchema,
  ConfirmPersonConnectionInputSchema,
  CreatePersonConnectionInvitationInputSchema,
} from "./person-connections";

test("connection contracts accept only six-digit codes and reject caller-controlled ownership fields", () => {
  assert.equal(
    ConfirmPersonConnectionInputSchema.safeParse({ confirmationCode: "012345" }).success,
    true,
  );
  for (const confirmationCode of ["12345", "1234567", "abcdef", 123456, " 123456"])
    assert.equal(ConfirmPersonConnectionInputSchema.safeParse({ confirmationCode }).success, false);
  assert.equal(
    CreatePersonConnectionInvitationInputSchema.safeParse({
      personId: randomUUID(),
      ownerUserId: randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    ClaimPersonConnectionInvitationInputSchema.safeParse({
      token: "a".repeat(32),
      recipientUserId: randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    ClaimPersonConnectionInvitationInputSchema.safeParse({ token: "short" }).success,
    false,
  );
});
