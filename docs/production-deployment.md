# Implantação em produção (servidor Oracle)

A aplicação roda no servidor Oracle (`ssh oracle`, Ubuntu 24.04 arm64) em
`https://finance.cvicent.com.br`. A máquina de desenvolvimento apenas envia o código; as imagens
são construídas no próprio servidor. Os arquivos de referência ficam em `deploy/oracle/`.

## Topologia

```text
Cloudflare (Full strict) ─> nginx :443 ─┬─> finance.cvicent.com.br       ─> web  127.0.0.1:7002 ─> api :7001
                                        └─> finance-files.cvicent.com.br ─> Garage 127.0.0.1:3900

rede Docker "openmonetis": openmonetis-pg · openmonetis-garage · api · recurring-worker · web · migrator
```

| Diretório no servidor | Projeto Compose | Conteúdo |
| --- | --- | --- |
| `/opt/openmonetis/db` | `openmonetis-db` | PostgreSQL 16 (`openmonetis-pg`), só em `127.0.0.1:5433`, limite de 768 MB. Bancos `openmonetis` (produção) e `openmonetis_dev`. |
| `/opt/openmonetis/storage` | `openmonetis-storage` | Garage v2.4.1 (`openmonetis-garage`), bucket privado `openmonetis-attachments`, chave `openmonetis-app`. |
| `/opt/openmonetis/app` | `openmonetis-app` | Código enviado (`src/`), `compose.yml` e `.env` da aplicação. |

Banco e storage têm ciclo de vida próprio: um deploy da aplicação nunca recria esses containers.
Nenhum deles publica porta fora de `127.0.0.1`.

Segredos ficam apenas no servidor, com permissão `600`:

- `/opt/openmonetis/db/.env`: senha do PostgreSQL;
- `/opt/openmonetis/storage/.env`: `rpc_secret` e token de admin do Garage;
- `/opt/openmonetis/storage/app-key.env`: credencial S3 da aplicação;
- `/opt/openmonetis/app/.env`: variáveis da aplicação (modelo em `deploy/oracle/.env.example`).

## Deploy

```bash
bash scripts/deploy-oracle.sh
```

O script empacota a working tree (sem arquivos ignorados pelo Git), envia ao servidor, constrói as
imagens, aplica as migrations pelo `migrator` e reinicia API, worker e web. Acompanhe com:

```bash
ssh oracle "cd /opt/openmonetis/app && sudo docker compose ps && sudo docker compose logs --tail 50 api"
```

As migrations são forward-only. Faça backup antes de um deploy que inclua migration nova.

## Primeiro acesso e cadastro

O cadastro só aceita e-mails da lista de autorizados (`SIGNUP_POLICY=allowlist`). Na inicialização,
a API garante que `INITIAL_ADMIN_EMAIL` esteja na lista como administrador. Esse e-mail cria a conta,
confirma o endereço pelo link enviado e passa a ver **Painel admin** no menu do usuário, onde
gerencia os demais e-mails autorizados.

E-mails de confirmação e redefinição de senha saem pelo Resend, com remetente
`noreply@cvicent.com.br` (domínio verificado no Resend).

## HTTPS, proxy e IP do visitante

- Certificado Let's Encrypt `finance` (DNS-01 via Cloudflare) cobre os dois hostnames, com renovação
  automática.
- `/etc/nginx/snippets/cloudflare-real-ip.conf` confia nas faixas da Cloudflare e usa
  `CF-Connecting-IP`. O nginx sempre sobrescreve `X-Real-IP` com esse endereço; o web o repassa à API
  (`TRUSTED_CLIENT_IP_HEADER=x-real-ip`) para o rate limit por IP do login. Se a Cloudflare mudar as
  faixas, regenere o snippet a partir de `https://www.cloudflare.com/ips`.
- Não encaminhe `/api-proxy` diretamente à API: o web faz o proxy same-origin.

## Anexos (Garage)

O navegador recebe uma URL assinada da API e envia o arquivo direto a
`https://finance-files.cvicent.com.br`; a assinatura inclui o `Host`, que o nginx preserva. O CORS
do bucket aceita somente `PUT`, `GET` e `HEAD` da origem `https://finance.cvicent.com.br`. Os
anexos têm limite de 50 MiB, abaixo do limite de upload do plano gratuito da Cloudflare.

Comandos administrativos do Garage:

```bash
ssh oracle "sudo docker exec openmonetis-garage /garage status"
ssh oracle "sudo docker exec openmonetis-garage /garage bucket info openmonetis-attachments"
```

## Backup e restauração

Uma restauração completa precisa de três conjuntos: dump do PostgreSQL, dados do Garage e os
arquivos de segredo listados acima. Para um ponto consistente, pare as escritas:

```bash
ssh oracle "cd /opt/openmonetis/app && sudo docker compose stop api recurring-worker web"
ssh oracle "sudo docker exec openmonetis-pg pg_dump -U openmonetis -d openmonetis -Fc" \
  > openmonetis-$(date +%Y%m%d-%H%M%S).dump
ssh oracle "sudo tar -czf - -C /var/lib/docker/volumes openmonetis-storage_meta openmonetis-storage_data" \
  > openmonetis-storage-$(date +%Y%m%d-%H%M%S).tgz
ssh oracle "cd /opt/openmonetis/app && sudo docker compose up -d"
```

Confirme que os comandos terminaram com código zero. O dump contém hashes de senha, passkeys e
sessões: trate-o como segredo, criptografe-o e guarde-o fora do servidor. Para restaurar, use um banco
vazio da mesma versão principal (`pg_restore --exit-on-error --no-owner --no-privileges`), restaure os
volumes do Garage com o container parado e recoloque os mesmos segredos antes de iniciar a aplicação.

## Verificação pós-deploy

- `https://finance.cvicent.com.br` abre a tela de login;
- `sudo docker compose ps` mostra API e web saudáveis e o `migrator` concluído;
- o `recurring-worker` está em execução sem falhas recorrentes;
- cadastro com e-mail não autorizado é recusado; o autorizado recebe o e-mail de confirmação;
- "Esqueci minha senha" envia o link de redefinição;
- upload e download de um anexo funcionam pela origem HTTPS.

## Checklist

- [ ] Segredos são exclusivos do servidor e nunca foram versionados.
- [ ] PostgreSQL, Garage e API não estão expostos publicamente.
- [ ] Cloudflare em Full (strict) e HTTP redireciona para HTTPS.
- [ ] Backups do banco e do Garage são feitos e testados periodicamente.
- [ ] Logs e espaço em disco são monitorados.
