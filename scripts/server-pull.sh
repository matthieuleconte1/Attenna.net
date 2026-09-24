#!/usr/bin/env bash
# Déploiement côté serveur : récupère la branche "deploy" (artefacts déjà buildés
# par GitHub Actions) et la synchronise dans la racine nginx.
#
# Aucun Node / npm requis sur le serveur : la branche deploy ne contient que le
# résultat de `vite build`.
#
# Installation initiale :
#   sudo mkdir -p /srv/attenna /var/www/attenna
#   sudo chown -R "$USER" /srv/attenna /var/www/attenna
#   git clone --depth 1 -b deploy https://github.com/matthieuleconte1/Attenna.net.git /srv/attenna
#   ./server-pull.sh
#
# Usage courant : ./server-pull.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/attenna}"
WEB_ROOT="${WEB_ROOT:-/var/www/attenna}"
BRANCH="${BRANCH:-deploy}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Erreur : $REPO_DIR n'est pas un clone git. Voir l'en-tête du script." >&2
  exit 1
fi

# La CI force-push un commit orphelin à chaque build : les historiques n'ont
# aucun ancêtre commun, donc `git pull` échouerait. On se cale de force sur
# l'état distant.
git -C "$REPO_DIR" fetch --depth 1 origin "$BRANCH"
git -C "$REPO_DIR" reset --hard FETCH_HEAD
git -C "$REPO_DIR" clean -fdx

# --delete purge les anciens assets hashés par Vite.
# .git est exclu : il ne doit jamais se retrouver sous la racine web.
# --checksum : indispensable ici. Par défaut rsync compare taille + date, or
# index.html garde une taille identique quand seul un hash d'asset change
# (index-AAAA.js -> index-BBBB.js), et VERSION fait toujours 41 octets. Une
# comparaison sur la taille laisserait passer ces changements.
rsync -a --checksum --delete --exclude '.git' "$REPO_DIR"/ "$WEB_ROOT"/

echo "Déployé : $(cat "$WEB_ROOT/VERSION" 2>/dev/null || echo 'version inconnue')"
