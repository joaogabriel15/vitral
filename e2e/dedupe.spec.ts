// dedupe: três remotes React numa página sem React baixam o React uma vez só,
// mesmo carregando juntos. Usa o build de verdade do exemplo React
// (examples/remotes/react, com `dedupe: ['react']`), servido em três URLs.
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../packages/vitral/dist/', import.meta.url))
const remote = fileURLToPath(new URL('../examples/remotes/react/dist/', import.meta.url))

const PAGE = `<!doctype html><body><main id="app"></main><script type="module" src="/host.js"></script></body>`

const HOST = `
import { configure, createSlot } from '/vitral/index.js'
const names = ['a', 'b', 'c']
configure({ remotes: Object.fromEntries(names.map((n) => [n, '/r/' + n + '/vitral.json'])) })
const app = document.getElementById('app')
await Promise.all(names.map((name) => new Promise((resolve, reject) => {
  createSlot(app.appendChild(document.createElement('section')), {
    name,
    props: { mensagem: name },
    onStatus: (s, e) => (s === 'ready' ? resolve() : s === 'error' && reject(e)),
  })
})))
document.body.dataset.ready = '1'
`

let server: Server
let origin = ''
const requests: string[] = []

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://x')
    requests.push(url.pathname)
    if (url.pathname === '/') {
      const headers: Record<string, string> = { 'content-type': 'text/html' }
      const csp = url.searchParams.get('csp')
      if (csp) headers['content-security-policy'] = `script-src ${csp}`
      return void res.writeHead(200, headers).end(PAGE)
    }
    if (url.pathname === '/host.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(HOST)
    const file = url.pathname.startsWith('/vitral/')
      ? join(dist, url.pathname.slice(8))
      : /^\/r\/[abc]\//.test(url.pathname)
        ? join(remote, url.pathname.slice(5))
        : null
    try {
      const type = file!.endsWith('.json') ? 'application/json' : file!.endsWith('.css') ? 'text/css' : 'text/javascript'
      res.writeHead(200, { 'content-type': type }).end(await readFile(file!))
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
test.afterAll(() => server?.close())

const own = () => requests.filter((p) => p.includes('_vitral-own_react'))
const single = () => requests.filter((p) => /^\/r\/[abc]\/remote-[\w-]+\.js$/.test(p))

for (const [label, csp] of [
  ['sem CSP (import map onde houver)', null],
  ["CSP sem inline (modulepreload onde houver)", `'self' data: blob:`],
] as const) {
  test(`três remotes React juntos baixam o React uma vez: ${label}`, async ({ page }) => {
    requests.length = 0
    await page.goto(csp ? `${origin}/?csp=${encodeURIComponent(csp)}` : origin)
    await expect(page.locator('body[data-ready="1"]')).toHaveCount(1)
    await expect(page.locator('.cartao')).toHaveCount(3)
    // Os três respondem a clique (hooks do React compartilhado funcionando).
    for (const b of await page.locator('.ping').all()) await b.click()
    await expect(page.locator('.cliques')).toHaveText(['1', '1', '1'])
    if (single().length) {
      // Navegador que não confere hash por módulo (caminho blob:): cada um usa o arquivo único.
      expect(own()).toEqual([])
    } else {
      expect(own()).toHaveLength(1)
    }
  })
}
