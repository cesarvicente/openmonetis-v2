<p align="center">
  <img src="apps/web/public/images/openmonetis-mark.svg" width="112" alt="Símbolo do OpenMonetis" />
</p>

<h1 align="center">OpenMonetis</h1>

<p align="center">
  Gerenciador de finanças pessoais self-hosted, feito para acompanhar sua vida financeira com
  clareza e manter seus dados sob seu controle.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-Sustainable%20Use%201.0-f97316" alt="Licença Sustainable Use 1.0" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.12.0-f97316" alt="Versão 0.12.0" /></a>
  <img src="https://img.shields.io/badge/Docker-self--hosted-2496ED?logo=docker&logoColor=white" alt="Aplicação self-hosted com Docker" />
</p>

<p align="center">
  <a href="#desenvolvimento">Desenvolvimento</a> ·
  <a href="docs/production-deployment.md">Produção</a> ·
  <a href="docs/architecture.md">Arquitetura</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img src="apps/web/public/images/dashboard.png" width="1000" alt="Dashboard mensal do OpenMonetis" />
</p>

## O que você encontra

- contas, cartões, faturas, transações e transferências;
- parcelas, recorrências, orçamentos e contas a pagar;
- pessoas, divisões, repasses e gastos compartilhados entre contas;
- categorias e subcategorias, etiquetas, estabelecimentos, notas e checklists, além de anexos quando um storage S3 está
  configurado;
- relatórios, dashboard mensal e widgets configuráveis;
- importação por planilha e caixa de entrada do Companion Android com regras configuráveis de
  categorização e pessoa.

## Sobre este fork

Fork pessoal do [OpenMonetis V2](https://github.com/felipegcoutinho/openmonetis-v2), hospedado no
servidor Oracle. A máquina de desenvolvimento não hospeda a aplicação.

- Produção: `https://finance.cvicent.com.br`, publicada com `bash scripts/deploy-oracle.sh`
  ([guia de produção](docs/production-deployment.md)).
- Banco: PostgreSQL 16 em container dedicado (`openmonetis-pg`) no servidor Oracle, escutando só em
  `127.0.0.1:5433`. Bancos `openmonetis` (produção) e `openmonetis_dev` (desenvolvimento).
- Anexos: Garage (S3 self-hosted) no mesmo servidor, em `finance-files.cvicent.com.br`.
- Cadastro restrito aos e-mails autorizados no Painel admin, com confirmação de e-mail e
  redefinição de senha pelo Resend.
- Não existe integração com Open Finance. Os dados são inseridos manualmente, por planilha ou pelo
  fluxo de revisão do Companion.
- O único cliente implementado é o web. O Companion Android é um projeto externo que usa os
  endpoints de integração documentados.
- Backup: preserve o PostgreSQL com `pg_dump`, o storage de anexos e os segredos da implantação.

## Desenvolvimento

Tenha Node.js 22.12 ou superior, pnpm 11 e acesso SSH ao servidor (`ssh oracle`).

```bash
git clone https://github.com/cesarvicente/openmonetis-v2.git
cd openmonetis-v2
pnpm install --frozen-lockfile

cp .env.example .env    # preencha EXTERNAL_DATABASE_URL com a credencial do banco de dev
pnpm db:tunnel          # terminal separado: porta local 7010 -> Postgres do Oracle
pnpm db:migrate
pnpm dev
```

A aplicação web fica em `http://localhost:7002` e a API em `http://localhost:7001`. Detalhes no
[guia de desenvolvimento](CONTRIBUTING.md).

Comandos de validação:

```bash
pnpm check
pnpm test
pnpm build
```

Os testes de integração com PostgreSQL têm comandos próprios e não fazem parte de `pnpm test`.
Consulte os cenários e requisitos no [guia de desenvolvimento](CONTRIBUTING.md#testes-de-integração).

`pnpm lint` executa o Biome e a integração de `@shadcn/lint` via Oxlint no frontend.
Para executar apenas essa integração, use `pnpm lint:ui`. O plugin está registrado em
`apps/web/.oxlintrc.json`, inicialmente sem regras visuais ativadas; adicione as regras em
`rules` conforme a política visual desejada. Consulte as
[regras disponíveis](https://github.com/shadcn-ui/lint#rules). O tema e os componentes são
descobertos pelo `apps/web/components.json`. O Biome continua responsável pelas regras gerais.

## Arquitetura

O projeto é um monorepo TypeScript API-first. A API é a fonte de verdade, o domínio concentra as
regras financeiras e o cliente web apenas consulta e apresenta esse estado.

```text
TanStack Start -> Hono -> services -> domain
                              └-----> repositories -> Drizzle -> PostgreSQL
```

Stack principal: React, TanStack Start, Hono, Zod, Better Auth, Drizzle e PostgreSQL. Veja os
detalhes e as convenções no [`guia de arquitetura`](docs/architecture.md).

## Documentação

- [`docs/production-deployment.md`](docs/production-deployment.md): instalação, atualização,
  segurança operacional e backups;
- [`docs/architecture.md`](docs/architecture.md): camadas, decisões e estrutura do monorepo;
- [`docs/environment-variables.md`](docs/environment-variables.md): configuração dos serviços e integrações;
- [`docs/recurring-transactions.md`](docs/recurring-transactions.md): séries, versões, ocorrências e ações de recorrência;
- [`docs/settlements.md`](docs/settlements.md): baixas efetivas, extratos e contas a pagar;
- [`docs/due-date-rules.md`](docs/due-date-rules.md): calendário compartilhado, ajustes e exceções de vencimento;
- [`docs/companion-api.md`](docs/companion-api.md): contrato do Companion;
- [`docs/device-token-secret.md`](docs/device-token-secret.md): geração e rotação do segredo do Companion;
- [`CONTRIBUTING.md`](CONTRIBUTING.md): guia de desenvolvimento e testes.

## Licença

O OpenMonetis usa a [Sustainable Use License 1.0](LICENSE). O uso pessoal, não comercial e interno é
permitido; exploração comercial exige autorização separada do titular.
