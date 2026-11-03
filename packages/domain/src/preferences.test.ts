import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUserPreferences } from "./preferences";

test("color theme defaults to sepia and keeps known palettes", () => {
  assert.equal(normalizeUserPreferences(null).colorTheme, "sepia");
  assert.equal(normalizeUserPreferences({ colorTheme: "rose" }).colorTheme, "rose");
  assert.equal(normalizeUserPreferences({ colorTheme: "unknown" }).colorTheme, "sepia");
});

test("color theme is independent from the light or dark mode", () => {
  const preferences = normalizeUserPreferences({ theme: "dark", colorTheme: "nord" });
  assert.equal(preferences.theme, "dark");
  assert.equal(preferences.colorTheme, "nord");
});
