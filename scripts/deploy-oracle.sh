#!/usr/bin/env bash
# Envia a working tree atual ao servidor Oracle, constroi as imagens no servidor e reinicia a
# aplicacao. Arquivos ignorados pelo Git (.env, node_modules, builds) nunca sao enviados.
# Pre-requisitos no servidor: /opt/openmonetis/app/.env, rede Docker "openmonetis",
# containers openmonetis-pg e openmonetis-garage (veja docs/production-deployment.md).
set -euo pipefail

host="${OPENMONETIS_DEPLOY_HOST:-oracle}"
remote="/opt/openmonetis/app"
root="$(git rev-parse --show-toplevel)"
cd "$root"

archive="$(mktemp)"
trap 'rm -f "$archive"' EXIT

git ls-files -z --cached --others --exclude-standard \
  | while IFS= read -r -d '' file; do [ -f "$file" ] && printf '%s\0' "$file"; done \
  | tar --null -T - -czf "$archive"

echo "Enviando código para $host..."
scp -q "$archive" "$host:/tmp/openmonetis-src.tgz"
scp -q deploy/oracle/compose.yml "$host:/tmp/openmonetis-compose.yml"

ssh "$host" bash -s -- "$remote" <<'REMOTE'
set -euo pipefail
remote="$1"
sudo test -f "$remote/.env" || { echo "Falta $remote/.env no servidor"; exit 1; }
sudo rm -rf "$remote/src.new"
sudo mkdir -p "$remote/src.new"
sudo tar -xzf /tmp/openmonetis-src.tgz -C "$remote/src.new"
sudo rm -rf "$remote/src"
sudo mv "$remote/src.new" "$remote/src"
sudo mv /tmp/openmonetis-compose.yml "$remote/compose.yml"
rm -f /tmp/openmonetis-src.tgz
cd "$remote"
sudo docker compose build
sudo docker compose up -d --remove-orphans
sudo docker compose ps --format "table {{.Service}}\t{{.Status}}"
REMOTE
