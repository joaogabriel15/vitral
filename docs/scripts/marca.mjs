// Gera as imagens da marca em docs/public/marca/ a partir de scripts/marca/pecas.html.
// Uso: pnpm --dir docs marca (precisa do Chromium do Playwright, instalado pelo e2e).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')

const fonte = new URL('./marca/pecas.html', import.meta.url).href
const saida = (nome) => fileURLToPath(new URL(`../public/marca/${nome}`, import.meta.url))

const pecas = [
  { id: 'og', tema: 'claro', arquivo: 'og.png', escala: 1 },
  { id: 'banner', tema: 'claro', arquivo: 'banner.png', escala: 2 },
  { id: 'banner', tema: 'escuro', arquivo: 'banner-escuro.png', escala: 2 },
  { id: 'diagrama', tema: 'claro', arquivo: 'como-funciona.png', escala: 2 },
  { id: 'diagrama', tema: 'escuro', arquivo: 'como-funciona-escuro.png', escala: 2 },
]

const navegador = await chromium.launch()
for (const { id, tema, arquivo, escala } of pecas) {
  const pagina = await navegador.newPage({ deviceScaleFactor: escala, viewport: { width: 1400, height: 900 } })
  await pagina.goto(`${fonte}?tema=${tema}`)
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.locator(`#${id}`).screenshot({ path: saida(arquivo) })
  await pagina.close()
  console.log(arquivo)
}
await navegador.close()
