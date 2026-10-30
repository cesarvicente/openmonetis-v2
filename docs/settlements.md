# Baixas efetivas e contas a pagar

A baixa de uma receita ou despesa registra valor, data efetiva e conta, preservando o valor previsto.
O rateio efetivo é distribuído no domínio em centavos e armazenado separadamente. Em recorrências,
esses dados pertencem à ocorrência; a confirmação não modifica o valor das próximas.

Extratos e saldos usam a data e o valor efetivos. A lista de lançamentos mantém o período previsto;
quando filtrada por `payables=true`, acompanha o mês do vencimento ajustado. Os detalhes mostram os
valores previsto e efetivo, e a lista indica “Valor ajustado” quando são diferentes.

## Contrato HTTP e persistência

| Campo público | Significado |
| --- | --- |
| `amount` | Valor previsto do lançamento. |
| `isSettled` | Confirma ou desfaz a baixa. |
| `settledAmount` | Valor efetivo opcional, positivo e decimal, com até duas casas; quando omitido na confirmação, usa o previsto. |
| `settledDate` | Data efetiva opcional, sem datas futuras; quando omitida na confirmação, usa o dia atual no Brasil. |
| `accountId` | Conta da baixa, opcional; quando informada, precisa pertencer ao usuário e estar disponível. |

`PATCH /transactions/settlement` recebe `ids` e os campos de baixa. Para uma ocorrência recorrente,
`PATCH /transactions/recurring-occurrences/settlement` recebe `recurringRuleId`, `purchaseDate`
(referência nominal da ocorrência) e os campos de baixa. `isSettled: false` desfaz a confirmação.
O OpenAPI é a referência dos schemas completos; as rotas exigem autenticação e validam ownership.

Para registrar R$ 123,45, envie `settledAmount: 123.45`, não `12345`. O contrato usa a unidade
monetária; a distribuição do rateio em centavos é um detalhe do cálculo no domínio.

No banco, os campos usam snake_case, como `settled_amount` e `settled_date`. Confirmações e
desfazimentos geram eventos em `settlement_events`. Desfazer remove os dados efetivos ativos e
restaura a conta anterior, mantendo os eventos. Mudanças financeiras em registros confirmados
exigem desfazer a baixa.

A migration `0014_glossy_prowler.sql` adiciona campos opcionais e a tabela de eventos. Não há backfill
que invente datas efetivas para baixas anteriores. Registros legados preservam campos efetivos
nulos; a interface identifica a ausência da data e os cálculos mantêm o comportamento anterior
como fallback.

## Contas a pagar e faturas

O widget “Contas a pagar” acompanha despesas regulares com vencimento, por boleto, Pix, débito,
dinheiro, transferência bancária ou benefícios. Inclui parcelas e recorrências com vencimento
explícito. Despesas sem vencimento continuam na lista de lançamentos; compras no cartão continuam
nas faturas.

A lista prioriza contas pendentes por vencimento e mantém as pagas ao final. Avisos de vencimento
usam a mesma fonte. O filtro `payables=true` de `/transactions` reproduz esse recorte e pode ser
combinado com `settlement=unpaid`.

Cada lançamento aceita uma baixa integral, mesmo quando o valor efetivo difere do previsto; não há
saldo parcial desse lançamento. Cartão de crédito usa o fluxo separado de pagamento de fatura,
que já admite pagamentos parciais. Os snapshots de vencimento de contas a pagar e faturas seguem
as [regras de vencimento](due-date-rules.md). O ciclo de uma série está descrito em
[lançamentos recorrentes](recurring-transactions.md).

## Efetivação automática

Despesas e receitas fora do cartão, com vencimento, podem ser marcadas com “Efetivar
automaticamente” (`autoSettle: true` na API), avulsas, parceladas ou recorrentes. O worker
`auto-settle-worker` (`src/scripts/auto-settle.worker.ts`) roda a cada 5 minutos e, para cada
usuário com itens marcados, efetiva os que estão em aberto quando:

- o vencimento ajustado pelas [regras de vencimento](due-date-rules.md) chegou e o horário
  `autoSettleTime` das preferências (Ajustes, padrão `08:00`, horário de Brasília) passou;
- o vencimento é igual ou posterior ao dia em que o item foi marcado (`auto_settle_from`), para não
  efetivar atrasos antigos ao ligar a opção numa série;
- o vencimento está nos últimos 7 dias, o que recupera períodos em que o worker ficou parado.

A baixa usa o fluxo normal: data igual ao vencimento ajustado, valor previsto e a conta do
lançamento. Cada item efetivado recebe `auto_settled_at`; desfazer a baixa não faz o worker
efetivá-lo de novo. Desmarcar a opção ou remover o vencimento desliga a efetivação a partir dali.

## Verificação

1. Registre uma baixa com outro valor, conta e data efetiva; confira os detalhes e o extrato no mês da baixa.
2. Confirme uma ocorrência recorrente e confira que as próximas mantêm o valor previsto.
3. Desfaça a baixa e confira a restauração dos dados anteriores e do vencimento aplicável.
4. Cadastre uma despesa por Pix ou débito com vencimento e confira widget, filtro e avisos.
5. Confira que registros legados sem data efetiva continuam identificados e contabilizados.

Execute `pnpm test`, `pnpm test:settlements:integration` e, para recorrências,
`pnpm test:recurring:integration`, além de `pnpm check` e `pnpm build`.
Os requisitos de banco estão em [CONTRIBUTING.md](../CONTRIBUTING.md#testes-de-integração).
