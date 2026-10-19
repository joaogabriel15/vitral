// Widget em site de terceiros: uma página HTML pura com a tag do embed.js,
// sem bundler e sem configure(), com a CSP da receita da doc.
//
//   :4299  site do terceiro
//   :4297  CDN da lib (dist/embed.js)
//   :4298  CDN do widget: /chat/<versão>/ (arquivos que nunca mudam) e
//          /chat/canal.json, editado pela CLI (`vitral canal`) durante o teste
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
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

/** Pastas de versão do CDN. O canal fica em disco, para a CLI editar. */
function publish() {
  const files: Record<string, string> = {}
  for (const v of ['1.0.0', '2.0.0']) {
    const js = remote(v)
    files[`/chat/${v}/remote-x.js`] = js
    files[`/chat/${v}/remote.css`] = CSS
    files[`/chat/${v}/vitral.json`] = JSON.stringify({ name: 'chat', version: v, entry: 'remote-x.js', css: ['remote.css'], integrity: sri(js), files: { 'remote.css': sri(CSS) } })
  }
  const canal = join(mkdtempSync(join(tmpdir(), 'vitral-embed-')), 'canal.json')
  /** `npx vitral canal canal.json ...args` */
  const cli = (...args: string[]) => execFileSync('node', [join(root, 'packages/vitral/dist/cli.js'), 'canal', canal, ...args])
  return { files, canal, cli }
}

const types: Record<string, string> = { js: 'text/javascript', json: 'application/json', css: 'text/css' }

async function open(page: Page, csp = CSP.nonce) {
  const cdn = publish()
  cdn.cli('--stable', '1.0.0')
  const requests: string[] = []
  await page.route(/^http:\/\/localhost:(4297|4298|4299)\//, async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === SITE) {
      const html = `<!doctype html><meta charset="utf-8"><title>Site</title>
        <p class="site">texto do site</p><div id="chat"></div>
        <script nonce="abc" src="${LIB}/embed.js" data-remote="${CDN}/chat/canal.json" data-target="#chat" data-props='{"lang":"pt"}' async></script>`
      return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } })
    }
    const ext = url.pathname.split('.').pop()!
    const headers = { 'access-control-allow-origin': '*' }
    if (url.origin === LIB) return route.fulfill({ body: readFileSync(join(root, 'packages/vitral/dist', url.pathname)), contentType: types[ext], headers })
    requests.push(url.pathname)
    const body = url.pathname === '/chat/canal.json' ? readFileSync(cdn.canal, 'utf8') : cdn.files[url.pathname]
    return route.fulfill(body === undefined ? { status: 404, body: '', headers } : { body, contentType: types[ext], headers })
  })
  const erros: string[] = []
  const csps: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  // A sonda do SRI (`core/sri.ts`) importa de propósito um `blob:` com hash
  // errado para ver se o import map confere hashes; o Chromium registra a recusa.
  const sonda = (t: string) => /integrity/.test(t) && /blob:/.test(t)
  page.on('console', (m) => m.type() === 'error' && !sonda(m.text()) && (m.text().startsWith('CSP:') ? csps : erros).push(m.text()))
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`)))
  await page.goto(`${SITE}/`)
  return { erros, csps, requests, cli: cdn.cli }
}

const widget = (page: Page) => page.locator('#chat vitral-remote .widget')

test('uma tag no site: monta a versão estável do canal no Shadow DOM, sem vazar CSS e dentro da CSP com nonce', async ({ page }) => {
  const { erros, csps, requests } = await open(page)
  await expect(widget(page)).toHaveText('v1.0.0 pt')
  await expect(widget(page)).toHaveCSS('color', 'rgb(0, 128, 0)')
  // O `p { color }` do widget não chega no site.
  await expect(page.locator('p.site')).toHaveCSS('color', 'rgb(0, 0, 0)')
  expect(await page.locator('#chat [data-vitral-slot]').evaluate((el) => !!el.shadowRoot)).toBe(true)
  // O canal só diz a versão; manifesto, JS e CSS vêm da pasta dela.
  expect(requests).toEqual(expect.arrayContaining(['/chat/canal.json', '/chat/1.0.0/vitral.json', '/chat/1.0.0/remote-x.js', '/chat/1.0.0/remote.css']))
  expect(requests.some((r) => r.startsWith('/chat/2.0.0/'))).toBe(false)
  expect(erros).toEqual([])
  expect(csps).toEqual([])
})

test('canary editada pela CLI chega no site; voltar a versão é editar o canal', async ({ page }) => {
  const { erros, cli } = await open(page)
  await expect(widget(page)).toHaveText('v1.0.0 pt')
  cli('--canary', '2.0.0', '--percent', '100')
  await page.reload()
  await expect(widget(page)).toHaveText('v2.0.0 pt')
  await page.locator('#chat vitral-remote').evaluate((el: any) => (el.props = { lang: 'en' }))
  await expect(widget(page)).toHaveText('v2.0.0 en')
  cli('--canary', 'off')
  await page.reload()
  await expect(widget(page)).toHaveText('v1.0.0 pt')
  expect(erros).toEqual([])
})

// Aviso de violação que o próprio navegador escreve no console. Chromium:
// "...violates the following Content Security Policy directive...";
// Firefox: "Content-Security-Policy: The page’s settings blocked...";
// WebKit: "...does not appear in the script-src directive of the Content Security Policy."
const AVISO_CSP = /Content[- ]Security[- ]Policy/i
// Só os testes que a lib faz no navegador: o import map inline e os módulos `data:`.
const ESPERADA = /^CSP: script-src(-elem)? (inline|data(:.*)?)?$/

test('CSP só com a lista de origens: o widget monta (o hash é conferido pelo caminho do blob:)', async ({ page }) => {
  const { erros, csps } = await open(page, CSP.origens)
  await expect(widget(page)).toHaveText('v1.0.0 pt')
  // Sem nonce, a CSP recusa os testes da lib; eles só geram aviso de
  // violação. Qualquer outra violação ou erro na página falha o teste.
  expect(csps.filter((c) => !ESPERADA.test(c))).toEqual([])
  expect(erros.filter((e) => !AVISO_CSP.test(e))).toEqual([])
})
