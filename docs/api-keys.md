# Chaves de API

As chaves de API permitem que outros programas, como agentes de IA e scripts de importação, usem a
API do OpenMonetis sem a interface web. Cada chave age em nome de quem a criou e enxerga somente os
dados dessa conta.

## Criar e revogar

Em **Ajustes > Acesso à API**, clique em **Gerar chave**, informe um nome e escolha a validade
(30 dias, 90 dias, 1 ano ou sem expiração). A chave completa (`omk_…`) aparece uma única vez; depois
disso, a lista mostra apenas o prefixo, o último uso e a validade. Cada conta pode ter até 10 chaves
ativas.

Revogar uma chave encerra o acesso imediatamente. Os dados criados com ela são mantidos.

## Uso

Envie a chave no cabeçalho `Authorization` para os endereços sob `/api-proxy`, na mesma origem do
site:

```bash
curl -H "Authorization: Bearer omk_..." https://finance.cvicent.com.br/api-proxy/accounts

curl -X POST \
  -H "Authorization: Bearer omk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Conta corrente","type":"checking"}' \
  https://finance.cvicent.com.br/api-proxy/accounts
```

O contrato completo, com todos os endpoints e schemas, fica em `/api-proxy/openapi.json`. As
respostas seguem o formato `{ "data": ..., "error": null }`; erros retornam
`{ "error": true, "message": "...", "code": "..." }`.

## Escopo e limites

- Toda requisição com o cabeçalho `Authorization` é autenticada somente pela chave: uma chave
  inválida, expirada ou revogada retorna `401` (`invalid_api_key`), mesmo que o cookie de sessão
  também esteja presente.
- A chave acessa os mesmos recursos financeiros da interface web: contas, cartões, faturas,
  transações, categorias, etiquetas, pessoas, orçamentos, metas, notas, anexos, relatórios, caixa de
  entrada e regras.
- Rotas de credenciais e de conta exigem a sessão web e retornam `403` (`session_required`) para
  chaves: `/api-keys`, `/device-tokens`, `/settings` (segurança, reset e exclusão de conta) e
  `/admin`. Uma chave nunca tem papel de administrador.
- Vale o mesmo rate limit das mutações da sessão web, contado por usuário.

## Segurança

O banco guarda só um HMAC-SHA256 da chave, calculado com `DEVICE_TOKEN_SECRET`, e o prefixo exibido
na lista. Alterar esse segredo invalida todas as chaves de API e os tokens do Companion. Trate a chave
como uma senha: não a coloque em repositórios, logs nem prompts compartilhados, e prefira uma chave
por programa para poder revogá-las de forma independente.
