import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCategoryHierarchy,
  type CategoryHierarchyNode,
  expandCategoryIds,
} from "./categories";

const categories: CategoryHierarchyNode[] = [
  { id: "home", type: "expense", parentId: null, isSystem: false },
  { id: "light", type: "expense", parentId: "home", isSystem: false },
  { id: "travel", type: "expense", parentId: null, isSystem: false },
  { id: "salary", type: "income", parentId: null, isSystem: false },
  { id: "system", type: "expense", parentId: null, isSystem: true },
];

test("category families include direct and child IDs once while a child remains independent", () => {
  assert.deepEqual(expandCategoryIds(categories, ["home", "light", "home"]), ["home", "light"]);
  assert.deepEqual(expandCategoryIds(categories, ["light"]), ["light"]);
  assert.deepEqual(expandCategoryIds(categories, ["missing"]), ["missing"]);
  assert.deepEqual(expandCategoryIds(categories, []), []);
});

test("subcategories can move between root categories of the same type or become roots", () => {
  assert.doesNotThrow(() =>
    assertCategoryHierarchy({ id: "light", type: "expense", parentId: "travel", categories }),
  );
  assert.doesNotThrow(() =>
    assertCategoryHierarchy({ id: "light", type: "expense", parentId: null, categories }),
  );
});

test("hierarchy rejects foreign or missing parents, third levels, system parents and type mismatches", () => {
  for (const parentId of ["foreign", "light", "system", "salary"]) {
    assert.throws(() => assertCategoryHierarchy({ type: "expense", parentId, categories }), {
      code: "category_invalid_parent",
    });
  }
});

test("hierarchy rejects self-reference, moving a group under its child and changing a group's type", () => {
  assert.throws(
    () => assertCategoryHierarchy({ id: "light", type: "expense", parentId: "light", categories }),
    { code: "category_invalid_parent" },
  );
  assert.throws(
    () => assertCategoryHierarchy({ id: "home", type: "expense", parentId: "light", categories }),
    { code: "category_has_children" },
  );
  assert.throws(
    () => assertCategoryHierarchy({ id: "home", type: "income", parentId: null, categories }),
    { code: "category_has_children" },
  );
});
