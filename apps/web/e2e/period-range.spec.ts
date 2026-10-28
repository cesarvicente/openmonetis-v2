import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

for (const report of ["category-trends", "commitments"]) {
  test(`${report}: period picker applies, discards, limits and persists on mobile`, async ({
    page,
  }) => {
    const signup = await page.request.post("/api/auth/sign-up/email", {
      data: {
        name: "Period range user",
        email: `${randomUUID()}@example.test`,
        password: "browser-test-password-123",
      },
    });
    expect(signup.ok(), await signup.text()).toBeTruthy();
    await page.goto(`/reports/${report}?startPeriod=2026-04&endPeriod=2026-10`);
    const trigger = page.getByRole("button", { name: /^Período:/ });
    const month = (label: string) => page.getByRole("button", { name: label, exact: true });
    const apply = page.getByRole("button", { name: "Aplicar", exact: true });
    await expect(trigger).toContainText("abr/2026 – out/2026");
    await expect(page.getByRole("slider")).toHaveCount(0);

    // Closing the picker discards an unfinished selection.
    await trigger.click();
    await expect(month("abr/2026")).toHaveAttribute("aria-pressed", "true");
    await month("jul/2026").click();
    await expect(apply).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/startPeriod=2026-04/);
    await page.keyboard.press("Enter");
    await expect(month("abr/2026")).toHaveAttribute("aria-pressed", "true");
    await expect(month("jul/2026")).toHaveAttribute("aria-pressed", "false");

    // The second click closes the range, in any order.
    await month("out/2026").click();
    await month("jul/2026").click();
    await expect(page.getByRole("status")).toContainText("4 meses");
    await apply.click();
    await expect(page).toHaveURL(/startPeriod=2026-07/);
    await expect(page).toHaveURL(/endPeriod=2026-10/);
    await page.reload();
    await expect(trigger).toContainText("jul/2026 – out/2026");

    // Months beyond the 24-month limit from the first click are disabled.
    await trigger.click();
    await month("jul/2026").click();
    await page.getByRole("button", { name: "Ano anterior" }).click();
    await page.getByRole("button", { name: "Ano anterior" }).click();
    await expect(month("jul/2024")).toBeDisabled();
    await month("ago/2024").click();
    await expect(page.getByRole("status")).toContainText("24 meses");
    await apply.click();
    await expect(page).toHaveURL(/startPeriod=2024-08/);
    await expect(page).toHaveURL(/endPeriod=2026-07/);

    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Escolher período" });
    await expect(popup).toBeVisible();
    const bounds = await popup.boundingBox();
    expect(bounds).toBeTruthy();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    }
    await month("jul/2026").click();
    await month("jul/2026").click();
    await expect(page.getByRole("status")).toContainText("1 mês");
    await apply.click();
    await expect(page).toHaveURL(/startPeriod=2026-07/);
    await expect(page).toHaveURL(/endPeriod=2026-07/);
    await expect(trigger).toContainText("jul/2026 – jul/2026");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  });
}
