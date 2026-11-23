# Reembolsos, atrasados e pagamentos parciais

## Reembolsos

Quando "De quem é esta despesa?" é outra pessoa, ou a despesa é dividida com alguém, o sistema cria um
reembolso: uma receita de origem `reimbursement`, vinculada e travada. A despesa continua sendo do
usuário por inteiro, porque é ele quem paga a fatura ou a conta; o reembolso é o dinheiro que volta.

- **Um reembolso** por pessoa, por parcela e por ocorrência recorrente (até 12 meses à frente). Estornos
  da loja reduzem o que a pessoa deve.
- **Data prevista:** vencimento da fatura ou da despesa. Sem vencimento, a data é informada. Enquanto
  acompanha um vencimento, só pode mudar depois que ele passar.
- **Categoria:** sempre "Reembolso", categoria de sistema. Receitas manuais também podem usá-la.
- **Travado:** valor, nome, pessoa e categoria seguem a despesa. No reembolso se altera apenas o
  recebimento, "Reembolso garantido" e, quando atrasado, a previsão.
- **Já recebido:** valor e pessoa da despesa só mudam depois de desfazer o recebimento
  (`REIMBURSEMENT_RECEIVED`). Excluir a despesa exclui os reembolsos, inclusive os recebidos; a
  interface avisa, e o saldo é recalculado porque deriva dos lançamentos.

A sincronização (`reimbursements.service.ts`) compara o devido com o registrado e roda após qualquer
alteração financeira pela API e no `auto-settle-worker`. Ela nunca reescreve um reembolso recebido.

### O que conta

| Situação do reembolso | Saldo da conta | Receitas, previsões e saldos previstos | Categoria e orçamento da despesa |
| --- | --- | --- | --- |
| Pendente | não | não | despesa inteira |
| Pendente e garantido | não | sim, no mês previsto | despesa menos o reembolso, no mês da despesa |
| Recebido | sim, na data do recebimento | sim | despesa menos o reembolso, no mês da despesa |

Despesas e faturas usam sempre o valor integral. Relatórios com receitas e despesas lado a lado
(tendências e distribuição) abatem o reembolso na categoria da despesa em vez de somá-lo em
"Reembolso", para não contar o mesmo valor duas vezes. Uma receita manual em nome de outra pessoa segue
a mesma regra de garantia. Receitas não são divididas.

### Valor diferente do devido

- **Maior:** quita o reembolso. Se houver um próximo da mesma compra ou recorrência, o usuário escolhe
  entre descontar dele (pagamento parcial) ou registrar uma receita comum; sem próximo, vira receita.
- **Menor:** pede confirmação para quitar com reajuste, ou registra como parcial.

## Atrasados

Receitas e despesas fora do cartão, em aberto e com data vencida, ficam marcadas como atrasadas. No mês
atual (`includeOverdue=true`), a lista também traz as dos 12 meses anteriores, com `isCarriedOver`, sem
criar registros nem mudar datas. Faturas não pagas de meses anteriores aparecem em `cardInvoices` com
`isOverdue`. Nenhum total do mês soma esses itens.

## Pagamentos parciais

Um pagamento parcial é um lançamento próprio, quitado, com `parent_transaction_id`; o lançamento
principal passa a valer só o restante. Assim, saldos e totais somam sem duplicar. O parcial mantém a
competência do principal e entra na conta na data em que foi pago. Ele é travado: só se desfaz pelo
principal, e apenas enquanto este não estiver quitado. Com parciais, os dados financeiros do principal
não mudam (`PARTIAL_PAYMENT_REQUIRES_UNDO`).

O parcial de uma ocorrência recorrente primeiro a transforma em lançamento avulso e pula a ocorrência na
série. Cartão de crédito usa o pagamento parcial da fatura.

## Contratos

| Método e rota | Responsabilidade |
| --- | --- |
| `GET /reimbursements?period=2026-11` | O que cada pessoa deve e já pagou. |
| `GET /transactions/{id}/reimbursements` | Reembolsos da despesa, da compra parcelada ou do reembolso informado. |
| `GET /transactions/recurring-rules/{id}/reimbursements?occurrenceDate=…` | Reembolsos de uma despesa recorrente. |
| `PATCH /transactions/{id}/reimbursement` | Garantia e previsão de um reembolso pendente. |
| `GET` e `POST /transactions/{id}/partial-payments` | Consulta e registro de parciais. |
| `DELETE /transactions/{id}/partial-payments/{paymentId}` | Desfaz um parcial. |
| `POST /transactions/recurring-occurrences/partial-payments` | Parcial de uma ocorrência recorrente. |
| `PATCH /transactions/settlement` | `surplusDestination` (`income` ou `next`) define o destino da sobra. |

Despesas e receitas aceitam `isGuaranteed`; despesas sem vencimento aceitam `reimbursementDueDate`. A
migration `0030_reimbursements.sql` cria as colunas, torna "Reembolso" categoria de sistema, renomeia os
estornos antigos e remove a tabela dos antigos acertos (`person_settlements`).
