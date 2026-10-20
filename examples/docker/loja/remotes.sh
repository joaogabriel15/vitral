#!/bin/sh
# Escreve a lista de remotes a partir da variável de ambiente.
# Trocar de ambiente é trocar a variável, sem novo build.
set -e
printf '%s\n' "$VITRAL_REMOTES" > /usr/share/nginx/html/remotes.json
