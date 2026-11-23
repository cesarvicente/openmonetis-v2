import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { bootstrapIconCatalog } from "./bootstrap-icons.catalog";
import {
  categoryIconGroups,
  createCategoryIconLibrary,
  getBootstrapIconLabel,
  getCategoryIconSections,
} from "./category-icon-library";

const library = createCategoryIconLibrary([
  { value: "key", label: "Chave" },
  { value: "umbrella", label: "Praia" },
]);

function search(term: string, group: string | null = null) {
  return getCategoryIconSections(library, { group, search: term }).flatMap((section) =>
    section.options.map((option) => option.value),
  );
}

test("the catalog lists every icon of the installed Bootstrap Icons package", () => {
  const icons = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../node_modules/bootstrap-icons/icons",
  );
  assert.ok(existsSync(icons));
  const published = readdirSync(icons)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => file.slice(0, -".svg".length))
    .sort();
  const listed = bootstrapIconCatalog
    .trim()
    .split("\n")
    .map((line) => line.split(";")[0])
    .sort();
  assert.deepEqual(listed, published);
});

test("every icon belongs to a known group", () => {
  const groups = new Set(categoryIconGroups.map((group) => group.value));
  for (const option of library) {
    assert.ok(option.groups.length > 0, option.value);
    for (const group of option.groups) assert.ok(groups.has(group), `${option.value}: ${group}`);
  }
});

test("icons are found in Portuguese and in English, with or without accents", () => {
  for (const [portuguese, english, icon] of [
    ["Chave", "Key", "bi-key"],
    ["avião", "airplane", "bi-airplane"],
    ["onibus", "bus", "bi-bus-front"],
    ["cartão de crédito", "credit card", "bi-credit-card"],
    ["CAFÉ", "coffee", "bi-cup-hot"],
    ["saúde", "medical", "bi-hospital"],
    ["coração", "heart", "bi-heart-pulse"],
  ] as const) {
    assert.ok(search(portuguese).includes(icon), portuguese);
    assert.ok(search(english).includes(icon), english);
  }
});

test("the closest names come first and general icons keep their group", () => {
  assert.deepEqual(search("chave").slice(0, 2), ["key", "bi-key"]);
  assert.deepEqual(search("key").slice(0, 2), ["key", "bi-key"]);
  assert.deepEqual(search("", "general"), ["key", "umbrella"]);
  assert.ok(search("guarda-chuva", "general").includes("umbrella"));
  assert.deepEqual(search("palavra inexistente"), []);
});

test("without a filter each icon appears once, and a filter keeps all its groups", () => {
  const all = search("");
  assert.equal(all.length, library.length);
  assert.equal(new Set(all).size, library.length);
  assert.ok(search("", "love").includes("bi-arrow-through-heart"));
  assert.ok(search("", "arrows").includes("bi-arrow-through-heart"));
});

test("labels are composed in Portuguese", () => {
  assert.equal(getBootstrapIconLabel("key-fill"), "Chave (preenchido)");
  assert.equal(
    getBootstrapIconLabel("arrow-down-left-circle"),
    "Seta para baixo à esquerda em círculo",
  );
  assert.equal(getBootstrapIconLabel("cart4"), "Carrinho de compras 4");
  assert.equal(getBootstrapIconLabel("piggy-bank"), "Cofrinho");
});
