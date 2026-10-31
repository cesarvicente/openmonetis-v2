import assert from "node:assert/strict";
import test from "node:test";
import { calculateInstallmentPurchaseTotal } from "./installments";

test("installment purchase total sums every tracked installment", () => {
  assert.equal(
    calculateInstallmentPurchaseTotal({
      originalTransactionAmount: "100.00",
      totalInstallments: 3,
      trackedFromInstallment: 1,
      trackedTransactionAmounts: ["-33.34", "-33.33", "-40.00"],
    }),
    106.67,
  );
});

test("installment purchase total includes installments paid before tracking", () => {
  assert.equal(
    calculateInstallmentPurchaseTotal({
      originalTransactionAmount: "100.00",
      totalInstallments: 4,
      trackedFromInstallment: 3,
      trackedTransactionAmounts: ["-25.00", "-25.00"],
    }),
    100,
  );
});

test("installment purchase total falls back to the original amount without installments", () => {
  assert.equal(
    calculateInstallmentPurchaseTotal({
      originalTransactionAmount: "90.00",
      totalInstallments: 3,
      trackedFromInstallment: 1,
      trackedTransactionAmounts: [],
    }),
    90,
  );
});
