// Prefetch preditivo (`vitral/prefetch`): depois de A → B algumas vezes, uma
// visita nova a A baixa B no tempo ocioso, sem executar, e B monta sem baixar
// de novo. Os remotes têm build dividido com SRI, então cada navegador usa o
// caminho de SRI dele (import map, modulepreload com integrity ou fetch).
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../packages/vitral/dist/', import.meta.url))
const sha = (s: string) => 'sha384-' + createHash('sha384').update(s).digest('base64')

const HOST_JS = `
import { configure, navigate } from '/vitral/index.js'
import { routes } from '/vitral/routes.js'
import { prefetch } from '/vitral/prefetch.js'
configure({ retries: 0, remotes: { a: '/r/a/vitral.json', b: '/r/b/vitral.json' } })
routes({ '/a': 'a', '/b': 'b' })
window.__navigate = navigate
window.__prefetched = []
prefetch({ onPrefetch: (names) => window.__prefetched.push(...names) })
`

const files = (r: string): Record<string, string> => ({
  'split/entry.js': `import { label } from './chunk.js'; (window.__ran ||= []).push('${r}/entry.js'); export default { mount(el) { el.textContent = label; return { unmount() {} } } }`,
  'split/chunk.js': `(window.__ran ||= []).push('${r}/chunk.js'); export const label = 'remote ${r}'`,
})

let server: Server
let origin = ''
const requests: string[] = []

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url!, 'http://x')
    requests.push(pathname)
    if (pathname === '/a' || pathname === '/b') {
      return void res
        .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        .end('<!doctype html><body><vitral-outlet></vitral-outlet><script type="module" src="/host.js"></script></body>')
    }
    if (pathname === '/host.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(HOST_JS)
    if (pathname.startsWith('/vitral/')) {
      try {
        return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(await readFile(join(dist, pathname.slice(8))))
      } catch {
        return void res.writeHead(404).end()
      }
    }
    const m = /^\/r\/(a|b)\/(.+)$/.exec(pathname)
    if (!m) return void res.writeHead(404).end()
    const good = files(m[1])
    if (m[2] === 'vitral.json') {
      const manifest = {
        name: m[1],
        entry: 'split/entry.js',
        integrity: sha(good['split/entry.js']),
        files: Object.fromEntries(Object.entries(good).map(([f, c]) => [f, sha(c)])),
        split: { entry: 'split/entry.js', chunks: ['split/chunk.js'] },
      }
      return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }).end(JSON.stringify(manifest))
    }
    if (!(m[2] in good)) return void res.writeHead(404).end()
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' }).end(good[m[2]])
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})

test.afterAll(() => server?.close())

const outlet = (page: Page, route: string) => page.locator(`vitral-outlet[data-vitral-route="${route}"][data-vitral-status="ready"]`)

async function go(page: Page, route: string) {
  await page.evaluate((r) => (window as any).__navigate(r), `/${route}`)
  await expect(outlet(page, route)).toHaveText(`remote ${route}`)
}

test('depois de A → B algumas vezes, a próxima visita a A pré-carrega B sem executar', async ({ browser }) => {
  // Treino: A → B → A três vezes. As contagens ficam no localStorage.
  const training = await browser.newContext()
  const first = await training.newPage()
  await first.goto(`${origin}/a`)
  await expect(outlet(first, 'a')).toHaveText('remote a')
  for (let i = 0; i < 3; i++) {
    await go(first, 'b')
    await go(first, 'a')
  }
  const storageState = await training.storageState()
  await training.close()

  // Visita nova, com cache HTTP vazio e as contagens do treino.
  const context = await browser.newContext({ storageState })
  const page = await context.newPage()
  const errors: string[] = []
  // Os testes do SRI (`core/sri.ts`) carregam de propósito um módulo com hash
  // errado e, onde import maps tardios são recusados, um mapa recusado; cada
  // navegador registra isso do seu jeito. Nada mais pode ir para o console.
  const sonda = (t: string) => /integrity|import ?map/i.test(t)
  page.on('console', (m) => m.type() === 'error' && !sonda(m.text()) && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  const before = requests.length
  await page.goto(`${origin}/a`)
  await expect(outlet(page, 'a')).toHaveText('remote a')
  await page.waitForFunction(() => (window as any).__prefetched.includes('b'))

  const fetched = requests.slice(before)
  expect(fetched).toEqual(expect.arrayContaining(['/r/b/vitral.json', '/r/b/split/entry.js', '/r/b/split/chunk.js']))
  // Baixado, não executado.
  expect(await page.evaluate(() => (window as any).__ran)).toEqual(['a/chunk.js', 'a/entry.js'])

  await go(page, 'b')
  const all = requests.slice(before)
  // B monta com o que foi pré-carregado: cada arquivo baixado uma vez só.
  expect(all.filter((p) => p === '/r/b/split/entry.js')).toHaveLength(1)
  expect(all.filter((p) => p === '/r/b/split/chunk.js')).toHaveLength(1)
  expect(await page.evaluate(() => (window as any).__ran)).toEqual(['a/chunk.js', 'a/entry.js', 'b/chunk.js', 'b/entry.js'])
  expect(errors).toEqual([])
  await context.close()
})
