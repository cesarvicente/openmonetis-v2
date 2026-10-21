import assert from "node:assert/strict";
import test from "node:test";
import { parseChangelog } from "./releases-changelog";

test("parseChangelog joins indented continuation lines in release items", () => {
  const releases = parseChangelog(`# Changelog

## [1.2.3] - 2026-09-07

Resumo da versão em
mais de uma linha.

### Corrigido

- O texto do item continua na
  linha seguinte sem ser cortado.
`);

  assert.deepEqual(releases, [
    {
      version: "1.2.3",
      date: "2026-09-07",
      summary: "Resumo da versão em mais de uma linha.",
      upgradeNotes: [],
      sections: [
        {
          type: "fixed",
          items: ["O texto do item continua na linha seguinte sem ser cortado."],
        },
      ],
    },
  ]);
});

test("upgrade instructions are preserved separately from the summary and change sections", () => {
  const releases = parseChangelog(`## [Unreleased]
### Notas de atualização
- Do not include unreleased notes.
## [1.2.4] - 2026-10-12
Resumo curto.
### Alterado
- Fluxo atualizado.
### Notas de atualização
- Banco: faça backup antes de aplicar as migrations
  e acompanhe o migrator.
- Ambiente: configure DISABLE_SIGNUP=true.
### Outra seção
Texto que não pertence ao resumo.
## [1.2.3] - 2026-09-07
Versão anterior.
### Corrigido
- Correção anterior.
`);
  assert.equal(releases[0].summary, "Resumo curto.");
  assert.deepEqual(releases[0].upgradeNotes, [
    "Banco: faça backup antes de aplicar as migrations e acompanhe o migrator.",
    "Ambiente: configure DISABLE_SIGNUP=true.",
  ]);
  assert.deepEqual(releases[0].sections, [{ type: "changed", items: ["Fluxo atualizado."] }]);
  assert.deepEqual(releases[1].upgradeNotes, []);
  assert.equal(releases[1].summary, "Versão anterior.");
});
