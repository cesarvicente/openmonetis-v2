# Guia de desenvolvimento

As regras obrigatórias estão em [`AGENTS.md`](AGENTS.md) e a visão arquitetural em
[`docs/architecture.md`](docs/architecture.md).

## Ambiente local

Use Node.js 22.12 ou superior e pnpm 11 (o `packageManager` do `package.json` fixa a versão).
O banco de desenvolvimento fica no servidor Oracle e é acessado por túnel SSH; ele só escuta em
`127.0.0.1` no servidor e nunca é exposto à internet.

```bash
pnpm install --frozen-lockfile
cp .env.example .env    # depois preencha EXTERNAL_DATABASE_URL com a credencial do banco de dev
pnpm db:tunnel          # terminal separado: porta local 7010 -> Postgres do Oracle
pnpm db:migrate
pnpm dev
```

Sem acesso ao servidor, é possível usar um PostgreSQL local com Docker: deixe
`EXTERNAL_DATABASE_URL` vazia e rode `pnpm docker:db` antes de `pnpm db:migrate`.

## Regras de implementação

- UI não acessa banco nem implementa regra financeira.
- Routes são finas e validam entradas.
- Services implementam um caso de uso por função.
- Regras financeiras ficam no domain puro.
- Repositories filtram toda operação por `userId`.
- Código, banco e contratos usam inglês; a interface usa PT-BR.
- Mudanças de schema sempre incluem migration revisada.
- Migrations publicadas são imutáveis: preserve arquivos, hashes e timestamps existentes e adicione
  uma nova migration incremental para cada alteração.
- Novas features mantêm o mesmo nome e seguem o shape padronizado nas camadas aplicáveis, sem criar
  arquivos vazios apenas para completar a estrutura.

## Concluir uma mudança

Registre cada mudança notável em `Unreleased` no `CHANGELOG.md`, no mesmo commit da implementação,
testes e documentação. Antes de commitar:

```bash
pnpm check
pnpm test
pnpm build
```

A suíte automatizada cobre domínio, services, contratos HTTP, segurança e apresentação web.
O comando `pnpm test` descobre automaticamente arquivos `*.test.ts` e `*.test.tsx` em `src` dos
workspaces, excluindo `*.integration.test.*`. Consulte [o guia de testes](docs/testing.md) para os
limites atuais e as próximas prioridades.

### Testes de integração

`pnpm test` executa a suíte sem banco; as integrações PostgreSQL são comandos separados. Execute as
suítes relacionadas à mudança, além dos comandos acima. A CI executa todas as integrações.

| Mudança | Comando | Cobertura principal |
| --- | --- | --- |
| Autenticação | `pnpm test:auth:integration` | Cadastro aberto/fechado e login existente por senha e Google, com callback OAuth simulado. |
| Categorias | `pnpm test:categories:integration` | Hierarquia, unicidade, ownership e integridade dos vínculos financeiros. |
| Etiquetas | `pnpm test:tags:integration` | Persistência, ownership e vínculos de lançamentos e escopos de recorrência. |
| Recorrências | `pnpm test:recurring:integration` | Ações datadas, histórico, prazo final, projeções e relatórios. |
| Baixas e vencimentos | `pnpm test:settlements:integration` | Valores efetivos, rateios, extratos, desfazimentos, regras de vencimento e snapshots. |
| Transações e segurança HTTP | `pnpm test:transactions:integration` | API montada com sessões reais, bloqueio de acesso anônimo, isolamento entre usuários, transferências, estornos e concorrência. |
| Integridade financeira | `pnpm test:financial-integrity:integration` | Baixas e rateios, lotes atômicos, parcelas, recorrências, exportações e permissões de faturas e orçamentos. |
| Distribuição financeira | `pnpm test:financial-distribution:integration` | Recortes por pessoa, rateios, baixas, previsões, contas fora do saldo e isolamento entre usuários. |

As suítes adicionais de conexões, importação, ajustes, ownership, migrations e storage estão
listadas em [docs/testing.md](docs/testing.md). Para executar todas, use `pnpm test:integration`
com PostgreSQL e S3Mock disponíveis. `pnpm test:coverage` gera o relatório e verifica os limites
mínimos de domínio/services; `pnpm test:e2e` inicia a aplicação isolada para os testes Chromium.

Cada suíte cria um banco exclusivo, aplica as migrations e o remove ao terminar. Use um PostgreSQL
de desenvolvimento ou teste, com uma credencial que possa criar e remover bancos. Nunca aponte
esses comandos para o banco de produção (`openmonetis`). Para escolher o servidor de teste,
configure `TEST_DATABASE_URL`; essa variável tem precedência sobre a conexão do `.env`.

Se houver migration, mudança de contrato, variável de ambiente ou alteração no Compose, inclua
`### Notas de atualização` no `CHANGELOG.md` com as ações necessárias no servidor.
