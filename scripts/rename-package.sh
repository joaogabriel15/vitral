#!/usr/bin/env bash
# Troca o nome do pacote npm em todo o repositório: scripts/rename-package.sh <antigo> <novo>
set -euo pipefail
OLD=$1 NEW=$2
files=$(git ls-files | grep -E '\.(ts|tsx|js|jsx|mjs|vue|svelte|json|md|yml)$' | grep -v pnpm-lock.yaml)
for f in $files; do
  sed -i -E \
    -e "s#from '${OLD}(/[a-z]+)?'#from '${NEW}\1'#g" \
    -e "s#import\('${OLD}(/[a-z]+)?'\)#import('${NEW}\1')#g" \
    -e "s#\"${OLD}\": \"workspace:\*\"#\"${NEW}\": \"workspace:*\"#g" \
    -e "s#\`${OLD}(/[a-z]+)?\`#\`${NEW}\1\`#g" \
    -e "s#(npm (install|i) |pnpm add |yarn add )${OLD}\b#\1${NEW}#g" \
    "$f"
done
sed -i -E "s#\"name\": \"${OLD}\"#\"name\": \"${NEW}\"#" packages/*/package.json
if [ -d "packages/${OLD}" ] && [ ! -d "packages/${NEW}" ]; then git mv "packages/${OLD}" "packages/${NEW}"; fi
echo "Pacote renomeado: ${OLD} -> ${NEW}. Rode pnpm install."
