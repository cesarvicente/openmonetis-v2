import assert from "node:assert/strict";
import test from "node:test";
import { getInboxCaptureInitialState } from "./inbox";

const now = new Date("2026-11-12T15:00:00.000Z");

test("a capture identical to an existing one enters discarded as a duplicate", () => {
  assert.deepEqual(
    getInboxCaptureInitialState({ hasIdenticalCapture: true, matchesDiscardRule: true, now }),
    {
      status: "discarded",
      discardedAt: now,
      discardReason: "duplicate",
    },
  );
});

test("a new capture enters pending without a discard reason", () => {
  assert.deepEqual(
    getInboxCaptureInitialState({ hasIdenticalCapture: false, matchesDiscardRule: false, now }),
    { status: "pending", discardedAt: null, discardReason: null },
  );
});

test("a new capture matching a discard rule enters discarded by the rule", () => {
  assert.deepEqual(
    getInboxCaptureInitialState({ hasIdenticalCapture: false, matchesDiscardRule: true, now }),
    { status: "discarded", discardedAt: now, discardReason: "rule" },
  );
});
