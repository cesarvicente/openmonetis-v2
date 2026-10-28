import assert from "node:assert/strict";
import test from "node:test";
import {
  commitmentStatusLabel,
  formatCommitmentChartPeriod,
  formatCommitmentPercentage,
  resolveCommitmentsSearch,
  validateCommitmentsSearch,
} from "./commitments.presentation";

test("commitments search keeps a valid range and falls back to the default horizon", () => {
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2026-10", endPeriod: "2027-03" }),
    ),
    { startPeriod: "2026-10", endPeriod: "2027-03" },
  );
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2026-10", endPeriod: "bad" }),
    ),
    { startPeriod: "2026-10", endPeriod: "2027-03" },
  );
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2026-10", endPeriod: "2024-01" }),
    ),
    { startPeriod: "2026-10", endPeriod: "2027-03" },
  );
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2024-01", endPeriod: "2027-12" }),
    ),
    { startPeriod: "2024-01", endPeriod: "2024-06" },
  );
});

test("commitments search accepts the legacy period as the horizon start", () => {
  assert.deepEqual(resolveCommitmentsSearch(validateCommitmentsSearch({ period: "2026-03" })), {
    startPeriod: "2026-03",
    endPeriod: "2026-08",
  });
});

test("commitments labels are in Portuguese", () => {
  assert.equal(formatCommitmentPercentage(null), "—");
  assert.equal(formatCommitmentPercentage(35.1), "35,1%");
  assert.equal(commitmentStatusLabel("attention"), "Atenção");
  assert.match(formatCommitmentChartPeriod("2026-10"), /^Out/);
});
