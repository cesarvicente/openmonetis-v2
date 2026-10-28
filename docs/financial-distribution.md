# Distribuição financeira

O relatório em **Relatórios → Distribuição financeira** mostra as categorias de receita e de
despesa de um mês, agrupando subcategorias sem duplicar os valores. Usa o período dos lançamentos,
com valores efetivos quando houver baixa, e respeita a pessoa selecionada e seus rateios.

- **Lançados:** lançamentos avulsos, parcelas e ocorrências recorrentes confirmadas.
- **Com previsões:** inclui também as demais ocorrências de recorrências do mês. Confirmar uma
  ocorrência substitui seu valor previsto pelo efetivo; não adiciona uma segunda despesa.
- Transferências, pagamentos de fatura e ajustes de saldo não compõem receitas ou despesas.
- Contas marcadas como **Fora do saldo total** são excluídas automaticamente das receitas,
  despesas e previsões. Compras no cartão respeitam a conta associada; ocorrências recorrentes
  confirmadas respeitam a conta efetiva da baixa, mesmo quando diferente da conta da série.
- Lançamentos sem categoria aparecem em grupos separados para receitas e despesas.
- Estornos e reduções de fatura reduzem a despesa da categoria. Se o resultado da categoria for
  negativo, o gráfico representa esse valor na origem como estorno/ajuste, sem criar receita.
- O saldo do período é receitas menos despesas e não representa o saldo das contas. Quando
  negativo, o déficit aparece na origem para equilibrar o fluxo, sem ser contabilizado como receita.

Os percentuais do gráfico usam o total distribuído, incluindo estornos líquidos e déficit quando
necessários. As listas usam o total líquido do respectivo tipo; sem uma base positiva, mostram
`—`. As listas permitem expandir subcategorias e abrir a categoria no mês e pessoa selecionados.
O modo privacidade também oculta o gráfico e os percentuais.

A resposta inclui `savingsRatePercentage` (saldo ÷ receitas, `null` sem receitas) e `comparison`,
com receitas, despesas e saldo do mês anterior e a variação percentual de receitas e despesas
(`null` quando o mês anterior não tem base positiva). Em `sources` e `destinations`, as receitas
e despesas são limitadas a doze fluxos de cada tipo: as menores categorias são somadas em um fluxo
com `grouped: true`, exibido como "Outras categorias", conservando o total. Os fluxos adicionais
de estorno, saldo e déficit são preservados. As listas de categorias continuam completas.

`GET /reports/financial-distribution` aceita `period=YYYY-MM`, `personScope=admin|all|UUID` e
`mode=actual|forecast`. Os padrões são `admin` e `actual`; a sessão é obrigatória e a resposta é
privada, sem cache. O OpenAPI descreve o contrato completo. A exportação CSV usa o mesmo recorte e
identifica totais e detalhes de subcategorias separadamente.

Validação: `pnpm test`, `pnpm test:financial-distribution:integration`,
`pnpm exec playwright test financial-distribution.spec.ts`, `pnpm check`, `pnpm build` e
`pnpm release:check`. Os testes de integração e navegador usam banco temporário, conforme
[Testes](testing.md).
