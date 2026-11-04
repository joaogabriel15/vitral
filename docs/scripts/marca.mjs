// Gera as imagens da marca em docs/public/marca/ a partir de scripts/marca/pecas.html.
// Uso: pnpm --dir docs marca (precisa do Chromium do Playwright, instalado pelo e2e;
// CHROMIUM_PATH aponta para outro binário).
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
  { id: 'multizonas', tema: 'claro', arquivo: 'multizonas.png', escala: 2 },
  { id: 'multizonas', tema: 'escuro', arquivo: 'multizonas-escuro.png', escala: 2 },
  { id: 'dedupe', tema: 'claro', arquivo: 'dedupe.png', escala: 2 },
  { id: 'dedupe', tema: 'escuro', arquivo: 'dedupe-escuro.png', escala: 2 },
  { id: 'comunicacao', tema: 'claro', arquivo: 'comunicacao.png', escala: 2 },
  { id: 'comunicacao', tema: 'escuro', arquivo: 'comunicacao-escuro.png', escala: 2 },
  { id: 'seguranca', tema: 'claro', arquivo: 'seguranca.png', escala: 2 },
  { id: 'seguranca', tema: 'escuro', arquivo: 'seguranca-escuro.png', escala: 2 },
]

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
// Cada peça, menos a og, sai também em inglês: nome-en.png (README.en.md).
const todas = pecas.flatMap((p) =>
  p.id === 'og' ? [p] : [p, { ...p, lingua: 'en', arquivo: p.arquivo.replace('.png', '-en.png') }],
)
for (const { id, tema, arquivo, escala, lingua = 'pt' } of todas) {
  const pagina = await navegador.newPage({ deviceScaleFactor: escala, viewport: { width: 1400, height: 900 } })
  await pagina.goto(`${fonte}?tema=${tema}&lingua=${lingua}`)
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.locator(`#${id}`).screenshot({ path: saida(arquivo) })
  await pagina.close()
  console.log(arquivo)
}
await navegador.close()
