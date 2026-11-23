// Gera o catálogo de ícones de categoria a partir dos metadados do repositório twbs/icons.
// Uso: node scripts/generate-bootstrap-icon-catalog.mjs <pasta docs/content/icons da versão instalada>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) throw new Error("Informe a pasta docs/content/icons do repositório twbs/icons");

// Ícones publicados sem categoria na origem.
const missingCategories = {
  "globe-asia-australia-fill": "Geo",
  "leaf-fill": "Real world",
  pass: "Real world",
  "pass-fill": "Real world",
};

function readList(content, key) {
  const block = content.match(new RegExp(`^${key}:[ \t]*\n((?:[ \t]+-.*\n?)*)`, "m"))?.[1] ?? "";
  return [...block.matchAll(/^[ \t]+-[ \t]*(.+?)[ \t]*$/gm)].map(([, value]) =>
    value.replaceAll('"', ""),
  );
}

// A versão contornada vem antes da preenchida (`key`, `key-fill`).
function compareNames(left, right) {
  const [leftBase, rightBase] = [left, right].map((name) => name.replace(/-fill$/, ""));
  if (leftBase === rightBase) return left.length - right.length;
  return leftBase < rightBase ? -1 : 1;
}

const lines = readdirSync(source)
  .filter((file) => file.endsWith(".md"))
  .map((file) => file.slice(0, -3))
  .sort(compareNames)
  .map((name) => {
    const content = readFileSync(join(source, `${name}.md`), "utf8").replaceAll("\r\n", "\n");
    const categories = readList(content, "categories");
    if (categories.length === 0 && missingCategories[name]) {
      categories.push(missingCategories[name]);
    }
    const groups = categories.map((category) =>
      category
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")
        .replace(/-$/, ""),
    );
    const tags = readList(content, "tags").map((tag) => tag.toLowerCase().replace(/[;,`$]/g, ""));
    return [name, [...new Set(groups)].join(","), [...new Set(tags)].join(",")].join(";");
  });

writeFileSync(
  fileURLToPath(
    new URL("../apps/web/src/features/categories/bootstrap-icons.catalog.ts", import.meta.url),
  ),
  `// Gerado por scripts/generate-bootstrap-icon-catalog.mjs; não edite à mão.
// Cada linha é \`nome;categorias;tags\` do Bootstrap Icons (licença MIT).
export const bootstrapIconCatalog = \`
${lines.join("\n")}
\`;
`,
);
