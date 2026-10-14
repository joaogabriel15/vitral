// SRI nos três caminhos, com um servidor que adultera, erra o hash, cai e
// redireciona. Roda em Chromium, Firefox e WebKit (no CI).
//
// Cada navegador escolhe o caminho pelo próprio comportamento; a CSP da página
// tira os primeiros caminhos do jogo para testar os outros:
// - sem CSP: caminho 1 (import map) onde import maps tardios são aceitos;
// - `script-src 'self' data: blob:`: o import map inline é bloqueado, sobra o
//   2 (modulepreload) onde o teste com `data:` passa;
// - `script-src 'self' blob:`: sem `data:` o teste do modulepreload falha, sobra o 3 (`blob:`).
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { helper } from '../packages/vitral/src/vite/manifest'

const dist = fileURLToPath(new URL('../packages/vitral/dist/', import.meta.url))
const sha = (s: string) => 'sha384-' + createHash('sha384').update(s).digest('base64')

const HOST_JS = `
import { configure, createSlot } from '/vitral/index.js'
const q = new URLSearchParams(location.search)
const create = URL.createObjectURL
window.__blobs = 0
URL.createObjectURL = (b) => (window.__blobs++, create.call(URL, b))
configure({ retries: 0, remotes: { r: q.get('remote') } })
window.__slot = createSlot(document.getElementById('app'), {
  name: 'r',
  onStatus(status, error) {
    document.body.dataset.status = status
    document.body.dataset.error = error ? error.code : ''
  },
})
`

/**
 * Arquivos do remote. `base` é a URL absoluta da pasta, usada no import do
 * chunk. Nos modos `lazy*`, a entrada dividida faz `import()` de `lazy.js`
 * pelo helper que o plugin gera.
 */
function files(base: string, mode: Mode) {
  const good: Record<string, string> = {
    'remote.js': `(window.__ran ||= []).push('remote.js'); export default { mount(el) { el.textContent = 'ok arquivo único'; return { unmount() {} } } }`,
    'split/entry.js': `import { label } from '${base}split/chunk.js'; (window.__ran ||= []).push('entry.js'); export default { mount(el) { el.textContent = label; return { unmount() {} } } }`,
    'split/chunk.js': `(window.__ran ||= []).push('chunk.js'); export const label = 'ok dividido'`,
  }
  if (mode.startsWith('lazy')) {
    good['split/entry.js'] =
      `import { label } from '${base}split/chunk.js'; (window.__ran ||= []).push('entry.js'); ` +
      `export default { async mount(el) { const m = await __vitralImport('./lazy.js', ['./chunk.js']); el.textContent = label + ' ' + m.more; return { unmount() {} } } }\n${helper()}`
    good['split/lazy.js'] = `import './chunk.js'; (window.__ran ||= []).push('lazy.js'); export const more = 'e lazy'`
  }
  const bad = (f: string) => `window.__tampered = (window.__tampered || []).concat(${JSON.stringify(f)}); ` + good[f]
  return { good, bad }
}

type Mode = 'ok' | 'tamper' | 'wronghash' | 'flaky' | 'redirect' | 'lazy' | 'lazybad'

let server: Server
let origin = ''
const requests: string[] = []
const healed = new Set<string>()
const seen = new Map<string, number>()

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, origin)
    requests.push(url.pathname)
    const csp = url.searchParams.get('csp')
    if (url.pathname === '/') {
      const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }
      if (csp) headers['content-security-policy'] = `script-src ${csp}`
      return void res.writeHead(200, headers).end('<!doctype html><body><main id="app"></main><script type="module" src="/host.js"></script></body>')
    }
    if (url.pathname === '/host.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(HOST_JS)
    if (url.pathname.startsWith('/vitral/')) {
      try {
        const body = await readFile(join(dist, url.pathname.slice('/vitral/'.length)))
        return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(body)
      } catch {
        return void res.writeHead(404).end()
      }
    }
    // /r/<modo>/<id>/<arquivo> ou /outro/<modo>/<id>/<arquivo> (destino do redirect)
    const m = /^\/(r|outro)\/(\w+)\/(\w+)\/(.+)$/.exec(url.pathname)
    if (!m) return void res.writeHead(404).end()
    const [, area, mode, id, file] = m as unknown as [string, string, Mode, string, string]
    const base = `${origin}/r/${mode}/${id}/`
    const { good, bad } = files(base, mode)
    const headers = { 'content-type': 'text/javascript', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }
    if (file === 'vitral.json') {
      const hash = (f: string) => (mode === 'wronghash' ? sha('outro conteúdo') : sha(good[f]))
      const manifest = {
        name: 'r',
        entry: 'remote.js',
        integrity: hash('remote.js'),
        files: Object.fromEntries(Object.keys(good).filter((f) => f.startsWith('split/')).map((f) => [f, hash(f)])),
        split: { entry: 'split/entry.js', chunks: ['split/chunk.js'] },
      }
      return void res.writeHead(200, { ...headers, 'content-type': 'application/json' }).end(JSON.stringify(manifest))
    }
    if (!(file in good)) return void res.writeHead(404, headers).end()
    if (mode === 'flaky' && !healed.has(id)) return void req.socket.destroy()
    if (mode === 'redirect' && area === 'r' && file === 'split/entry.js') {
      return void res.writeHead(302, { ...headers, location: `/outro/${mode}/${id}/${file}` }).end()
    }
    // No destino do redirect, só o que foi verificado bate: o chunk de lá é adulterado.
    if (area === 'outro') return void res.writeHead(200, headers).end(file === 'split/entry.js' ? good[file] : bad(file))
    const n = (seen.get(url.pathname) ?? 0) + 1
    seen.set(url.pathname, n)
    // Adulterado: certo na primeira requisição, trocado em todas as outras.
    const tampered = ((mode === 'tamper' || mode === 'redirect') && n > 1) || (mode === 'lazybad' && file === 'split/lazy.js')
    res.writeHead(200, headers).end(tampered ? bad(file) : good[file])
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})

test.afterAll(() => server?.close())

let ids = 0
async function open(page: Page, mode: Mode, csp: string | null) {
  const id = `t${process.pid}x${ids++}`
  const q = new URLSearchParams({ remote: `/r/${mode}/${id}/vitral.json` })
  if (csp) q.set('csp', csp)
  await page.goto(`${origin}/?${q}`)
  await expect(page.locator('body[data-status="ready"], body[data-status="error"]')).toHaveCount(1)
  return id
}

const state = (page: Page) =>
  page.evaluate(() => ({
    status: document.body.dataset.status,
    error: document.body.dataset.error,
    text: document.getElementById('app')!.textContent,
    ran: (window as any).__ran ?? [],
    tampered: (window as any).__tampered ?? [],
    blobs: (window as any).__blobs as number,
    maps: document.querySelectorAll('script[type="importmap"]').length,
    preloads: document.querySelectorAll('link[rel="modulepreload"][href^="http"]').length,
  }))

/** Caminho usado: 1 (import map), 2 (modulepreload) ou 3 (`blob:`). */
const pathOf = (s: Awaited<ReturnType<typeof state>>) => (s.blobs ? 3 : s.preloads ? 2 : s.maps ? 1 : 0)

const CSPS = {
  'sem CSP': null,
  'CSP sem inline': `'self' data: blob:`,
  'CSP sem inline nem data:': `'self' blob:`,
} as const

// Caminho esperado em cada navegador. O Firefox recusa import maps tardios
// (fica no 2) e o WebKit ignora o integrity do modulepreload (pula o 2).
const EXPECTED: Record<string, Record<keyof typeof CSPS, number>> = {
  chromium: { 'sem CSP': 1, 'CSP sem inline': 2, 'CSP sem inline nem data:': 3 },
  firefox: { 'sem CSP': 2, 'CSP sem inline': 2, 'CSP sem inline nem data:': 3 },
  webkit: { 'sem CSP': 1, 'CSP sem inline': 3, 'CSP sem inline nem data:': 3 },
}

for (const [label, csp] of Object.entries(CSPS) as [keyof typeof CSPS, string | null][]) {
  test.describe(label, () => {
    test('carrega pelo caminho certo do navegador, rodando os arquivos verificados', async ({ page }, info) => {
      await open(page, 'ok', csp)
      const s = await state(page)
      const path = EXPECTED[info.project.name][label]
      expect(pathOf(s)).toBe(path)
      expect(s.status).toBe('ready')
      if (path < 3) {
        expect(s.text).toBe('ok dividido')
        expect(s.ran).toEqual(['chunk.js', 'entry.js'])
      } else {
        expect(s.text).toBe('ok arquivo único')
        expect(s.ran).toEqual(['remote.js'])
      }
    })

    test('arquivo adulterado depois da primeira requisição nunca executa', async ({ page }) => {
      await open(page, 'tamper', csp)
      const s = await state(page)
      expect(s.tampered).toEqual([])
      // Ou carregou com os bytes certos, ou falhou sem executar nada adulterado.
      if (s.status === 'error') expect(s.error).toBe('INTEGRITY')
    })

    test('hash errado no manifesto: nada executa', async ({ page }) => {
      await open(page, 'wronghash', csp)
      const s = await state(page)
      expect(s).toMatchObject({ status: 'error', error: 'INTEGRITY', ran: [], tampered: [] })
    })

    test('"Tentar de novo" carrega o remote depois de uma falha de rede, sem repetir a URL que falhou', async ({ page }) => {
      const id = await open(page, 'flaky', csp)
      expect(await state(page)).toMatchObject({ status: 'error', error: 'LOAD_FAILED' })
      healed.add(id)
      const before = requests.length
      await page.evaluate(() => (window as any).__slot.retry())
      await expect(page.locator('body[data-status="ready"]')).toHaveCount(1)
      const s = await state(page)
      expect(s.text).toBe('ok arquivo único')
      expect(requests.slice(before).filter((p) => p.includes(`/${id}/split/`))).toEqual([])
    })

    test('import() do remote também roda conferido', async ({ page }, info) => {
      await open(page, 'lazy', csp)
      const s = await state(page)
      const path = EXPECTED[info.project.name][label]
      expect(pathOf(s)).toBe(path)
      expect(s.status).toBe('ready')
      if (path < 3) {
        expect(s.text).toBe('ok dividido e lazy')
        expect(s.ran).toEqual(['chunk.js', 'entry.js', 'lazy.js'])
      } else {
        expect(s.text).toBe('ok arquivo único')
      }
    })

    test('import() de chunk adulterado não executa', async ({ page }, info) => {
      await open(page, 'lazybad', csp)
      const s = await state(page)
      expect(s.tampered).toEqual([])
      if (EXPECTED[info.project.name][label] < 3) expect(s.status).toBe('error')
      else expect(s.text).toBe('ok arquivo único')
    })

    test('com base absoluto, redirecionar a entrada não executa chunk sem verificação', async ({ page }) => {
      await open(page, 'redirect', csp)
      const s = await state(page)
      expect(s.tampered).toEqual([])
      if (s.status === 'error') expect(s.error).toBe('INTEGRITY')
    })
  })
}
