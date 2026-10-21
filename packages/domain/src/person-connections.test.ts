import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPersonConnectionInvitationTransition,
  isPersonConnectionConfirmationExpired,
  isPersonConnectionInvitationExpired,
  PersonConnectionTransitionError,
  personConnectionInvitationStatuses,
} from "./person-connections";

test("invitation state machine allows only claim, confirmation, cancellation and expiration from their valid states", () => {
  const allowed = new Set([
    "pending:claimed",
    "pending:cancelled",
    "pending:expired",
    "claimed:confirmed",
    "claimed:cancelled",
    "claimed:expired",
  ]);
  for (const from of personConnectionInvitationStatuses)
    for (const to of personConnectionInvitationStatuses) {
      if (allowed.has(`${from}:${to}`))
        assert.doesNotThrow(() => assertPersonConnectionInvitationTransition(from, to));
      else
        assert.throws(
          () => assertPersonConnectionInvitationTransition(from, to),
          PersonConnectionTransitionError,
        );
    }
});

test("invitation and confirmation deadlines expire at their exact boundary", () => {
  const deadline = new Date("2020-01-01T12:00:00Z");
  for (const check of [
    isPersonConnectionInvitationExpired,
    isPersonConnectionConfirmationExpired,
  ]) {
    assert.equal(check(deadline, new Date(deadline.getTime() - 1)), false);
    assert.equal(check(deadline, deadline), true);
    assert.equal(check(deadline, new Date(deadline.getTime() + 1)), true);
  }
  assert.equal(isPersonConnectionConfirmationExpired(null, deadline), true);
});
