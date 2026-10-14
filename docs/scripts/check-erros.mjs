// Confere que o link de cada código de erro abre uma página que existe.
//
//   node docs/scripts/check-erros.mjs          # depois de `vitepress build`
//   node docs/scripts/check-erros.mjs --live   # depois do deploy, contra o site publicado
//
// Os códigos e o endereço vêm de packages/vitral/src/core/errors.ts, a mesma
// fonte que monta `RemoteError.docs`.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SITE } from '../.vitepress/site.mjs'

const file = (path) => fileURLToPath(new URL(path, import.meta.url))
const src = readFileSync(file('../../packages/vitral/src/core/errors.ts'), 'utf8')
const codes = [...src.matchAll(/\| '([A-Z_]+)'/g)].map((m) => m[1])
const docs = src.match(/ERROR_DOCS = '([^']+)'/)?.[1]
const live = process.argv.includes('--live')
const falhas = []

if (codes.length === 0) falhas.push('nenhum código encontrado em errors.ts')
if (docs !== `${SITE}erros/`) falhas.push(`ERROR_DOCS é ${docs}, mas as páginas ficam em ${SITE}erros/`)

for (const code of codes) {
  if (live) {
    const url = `${docs}${code}`
    const res = await abrir(url)
    if (!res.ok) falhas.push(`${url} respondeu ${res.status}`)
  } else if (!existsSync(file(`../.vitepress/dist/erros/${code}.html`))) {
    falhas.push(`sem página para ${code} (crie docs/erros/${code}.md)`)
  }
}

// O CDN do Pages pode levar alguns segundos para servir o deploy novo.
async function abrir(url, tentativas = 4) {
  for (let i = 1; ; i++) {
    const res = await fetch(url).catch((e) => ({ ok: false, status: e.message }))
    if (res.ok || i === tentativas) return res
    await new Promise((r) => setTimeout(r, 15000))
  }
}

if (falhas.length) {
  console.error(falhas.map((f) => `✗ ${f}`).join('\n'))
  process.exit(1)
}
console.log(`✓ ${codes.length} códigos de erro com página${live ? ` em ${docs}` : ' no build do site'}`)
