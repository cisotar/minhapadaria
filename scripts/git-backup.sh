#!/usr/bin/env bash
# Backup automático do trabalho local para o remoto, em namespace separado.
# Empurra todos os branches locais para backup/* no origin — NUNCA toca main
# ou qualquer branch fora de backup/*. Rodado pelo timer systemd de usuário
# minhapadaria-backup.timer, fora do loop noturno (que é proibido de push).
set -euo pipefail

cd /home/ozzie/github/minhapadaria

# + = força: backup/* só é escrito por este script, então sobrescrever é seguro.
git push --quiet origin '+refs/heads/*:refs/heads/backup/*'

# Stash mais recente também (o loop preserva trabalho bloqueado via stash).
if git rev-parse -q --verify refs/stash >/dev/null; then
  git push --quiet origin '+refs/stash:refs/heads/backup/stash'
fi

echo "backup ok: $(git rev-parse --short HEAD)"
