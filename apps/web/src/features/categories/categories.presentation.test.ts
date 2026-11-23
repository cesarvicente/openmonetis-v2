import assert from "node:assert/strict";
import test from "node:test";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import {
  getCategoryGroups,
  getCategoryLabel,
  getCategoryPickerGroups,
  sortCategoryOptions,
} from "./categories.presentation";

const date = "2026-10-12T00:00:00.000Z";
const root: CategoryOutput = {
  id: "home",
  name: "Casa",
  icon: null,
  type: "expense",
  isSystem: false,
  createdAt: date,
  updatedAt: date,
  parentId: null,
};
const light: CategoryOutput = {
  ...root,
  id: "light",
  name: "Luz",
  parentId: "home",
  parentName: "Casa",
};
const water: CategoryOutput = { ...light, id: "water", name: "Água" };
const categories = [light, water, root, { ...root, id: "travel", name: "Viagem" }];

test("category search by parent includes children and search by child preserves parent context", () => {
  const byParent = getCategoryGroups(categories, "casa");
  assert.equal(byParent.length, 1);
  assert.deepEqual(
    byParent[0]?.children.map((child) => child.id),
    ["water", "light"],
  );
  const byChild = getCategoryGroups(categories, "luz");
  assert.equal(byChild[0]?.parent.id, "home");
  assert.deepEqual(
    byChild[0]?.children.map((child) => child.id),
    ["light"],
  );
  assert.equal(getCategoryGroups(categories, "missing").length, 0);
});

test("category options keep the parent before children and names include the full path", () => {
  assert.deepEqual(
    sortCategoryOptions(categories).map((category) => category.id),
    ["home", "water", "light", "travel"],
  );
  assert.equal(getCategoryLabel(light), "Casa › Luz");
  assert.equal(getCategoryLabel(root), "Casa");
});

test("category picker search ignores accents, keeps parent context and ranks name prefixes first", () => {
  const ids = (search: string) =>
    getCategoryPickerGroups(categories, search).map(({ parent, children, parentMatches }) => ({
      parent: parent.id,
      parentMatches,
      children: children.map((child) => child.id),
    }));
  assert.deepEqual(ids("agua"), [{ parent: "home", parentMatches: false, children: ["water"] }]);
  assert.deepEqual(ids("CASA"), [
    { parent: "home", parentMatches: true, children: ["water", "light"] },
  ]);
  assert.deepEqual(ids("casa luz"), [
    { parent: "home", parentMatches: false, children: ["light"] },
  ]);
  assert.deepEqual(
    ids("").map((group) => group.parent),
    ["home", "travel"],
  );
  const flat: CategoryOutput = { ...root, id: "flat", name: "Apê com água" };
  assert.deepEqual(
    getCategoryPickerGroups([...categories, flat], "agua").map((group) => group.parent.id),
    ["home", "flat"],
  );
});
