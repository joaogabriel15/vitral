// Widget em site de terceiros: uma página HTML pura com a tag do embed.js,
// sem bundler e sem configure(), com a CSP da receita da doc.
//
//   :4299  site do terceiro
//   :4297  CDN da lib (dist/embed.js)
//   :4298  CDN do widget: /chat/<versão>/ (arquivos que nunca mudam) e
//          /chat/<canal>/vitral.json, gerado por `vitral canal`
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const SITE = 'http://localhost:4299'
const LIB = 'http://localhost:4297'
const CDN = 'http://localhost:4298'
// As duas receitas de CSP da doc: com nonce (recomendada) e só com a lista de origens.
const CSP = {
  nonce: `script-src 'nonce-abc' 'strict-dynamic'; connect-src 'self' ${CDN}; style-src 'self' ${CDN}`,
  origens: `script-src 'self' ${LIB} ${CDN} blob:; connect-src 'self' ${CDN}; style-src 'self' ${CDN}`,
}

// Duas versões do widget. O CSS usa um seletor solto de propósito: fora do Shadow DOM, pintaria o site.
const remote = (v: string) => `export default {
  mount(el, props) {
    const p = el.appendChild(document.createElement('p'))
    p.className = 'widget'
    p.textContent = 'v${v} ' + props.lang
    return { update: (n) => (p.textContent = 'v${v} ' + n.lang), unmount: () => p.remove() }
  },
}`
const CSS = 'p { color: rgb(0, 128, 0); }'
const sri = (s: string) => 'sha384-' + createHash('sha384').update(s).digest('base64')

/** Arquivos do CDN: as pastas de versão e o manifesto de cada canal, feito pela CLI. */
function publish(): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'vitral-embed-'))
  const files: Record<string, string> = {}
  for (const v of ['1.0.0', '2.0.0']) {
    const js = remote(v)
    const manifest = { name: 'chat', version: v, entry: 'remote-x.js', css: ['remote.css'], integrity: sri(js), files: { 'remote.css': sri(CSS) } }
    files[`/chat/${v}/remote-x.js`] = js
    files[`/chat/${v}/remote.css`] = CSS
    files[`/chat/${v}/vitral.json`] = JSON.stringify(manifest)
    writeFileSync(join(dir, `${v}.json`), JSON.stringify(manifest))
  }
  for (const [canal, v] of [['stable', '1.0.0'], ['beta', '2.0.0']]) {
    const out = join(dir, canal, 'vitral.json')
    execFileSync('node', [join(root, 'packages/vitral/dist/cli.js'), 'canal', join(dir, `${v}.json`), '--out', out])
    files[`/chat/${canal}/vitral.json`] = readFileSync(out, 'utf8')
  }
  return files
}

const types: Record<string, string> = { js: 'text/javascript', json: 'application/json', css: 'text/css' }

async function open(page: Page, tag: string, csp = CSP.nonce) {
  const cdn = publish()
  const requests: string[] = []
  await page.route(/^http:\/\/localhost:(4297|4298|4299)\//, async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === SITE) {
      const html = `<!doctype html><meta charset="utf-8"><title>Site</title>
        <p class="site">texto do site</p><div id="chat"></div>${tag}`
      return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } })
    }
    const ext = url.pathname.split('.').pop()!
    const headers = { 'access-control-allow-origin': '*' }
    if (url.origin === LIB) return route.fulfill({ body: readFileSync(join(root, 'packages/vitral/dist', url.pathname)), contentType: types[ext], headers })
    requests.push(url.pathname)
    const body = cdn[url.pathname]
    return route.fulfill(body === undefined ? { status: 404, body: '', headers } : { body, contentType: types[ext], headers })
  })
  const erros: string[] = []
  const csps: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => m.type() === 'error' && (m.text().startsWith('CSP:') ? csps : erros).push(m.text()))
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`)))
  await page.goto(`${SITE}/`)
  return { erros, csps, requests }
}

const tag = (canal: string) =>
  `<script nonce="abc" src="${LIB}/embed.js" data-remote="${CDN}/chat/${canal}/vitral.json" data-target="#chat" data-props='{"lang":"pt"}' async></script>`

test('uma tag no site: monta o canal stable no Shadow DOM, sem vazar CSS e dentro da CSP com nonce', async ({ page }) => {
  const { erros, csps, requests } = await open(page, tag('stable'))
  const widget = page.locator('#chat vitral-remote .widget')
  await expect(widget).toHaveText('v1.0.0 pt')
  await expect(widget).toHaveCSS('color', 'rgb(0, 128, 0)')
  // O `p { color }` do widget não chega no site.
  await expect(page.locator('p.site')).toHaveCSS('color', 'rgb(0, 0, 0)')
  expect(await page.locator('#chat [data-vitral-slot]').evaluate((el) => !!el.shadowRoot)).toBe(true)
  // O canal só tem o manifesto; JS e CSS vêm da pasta da versão.
  expect(requests).toEqual(expect.arrayContaining(['/chat/stable/vitral.json', '/chat/1.0.0/remote-x.js', '/chat/1.0.0/remote.css']))
  expect(requests.filter((r) => r.startsWith('/chat/stable/'))).toEqual(['/chat/stable/vitral.json'])
  expect(erros).toEqual([])
  expect(csps).toEqual([])
})

test('o canal beta aponta para outra versão; props mudam pelo elemento', async ({ page }) => {
  const { erros } = await open(page, tag('beta'))
  const widget = page.locator('#chat vitral-remote .widget')
  await expect(widget).toHaveText('v2.0.0 pt')
  await page.locator('#chat vitral-remote').evaluate((el: any) => (el.props = { lang: 'en' }))
  await expect(widget).toHaveText('v2.0.0 en')
  expect(erros).toEqual([])
})

test('CSP só com a lista de origens: o widget monta (o hash é conferido pelo caminho do blob:)', async ({ page }) => {
  const { erros } = await open(page, tag('stable'), CSP.origens)
  await expect(page.locator('#chat vitral-remote .widget')).toHaveText('v1.0.0 pt')
  // Sem nonce, a CSP recusa os testes que a lib faz no navegador (import map
  // e módulos data:); eles só geram aviso de violação, sem erro na página.
  expect(erros.filter((e) => !e.startsWith('Refused to'))).toEqual([])
})
