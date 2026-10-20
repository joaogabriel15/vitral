// Gateway de edge (`vitral/edge`) no Node: host e remote de uma origem só, SSR
// em Declarative Shadow DOM e hidratação sem remontar.
//
//   navegador → gateway (este arquivo) → host (este arquivo) e CDN (fixtures/server.mjs)
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gateway, toNodeListener } from '../packages/vitral/dist/edge.js'
import { cdn } from './fixtures/cenario'
import { render } from './fixtures/remotes/ssr.js'

const dist = fileURLToPath(new URL('../packages/vitral/dist/', import.meta.url))

// O script inline roda logo depois do parser passar pelo remote, antes dos
// módulos: guarda o botão que veio do servidor para comparar depois.
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>edge</title></head><body>
<vitral-remote name="ssr" isolate="shadow" props='{"n":3}'><p slot="fallback">Carregando…</p></vitral-remote>
<script>
  const slot = document.querySelector('vitral-remote [data-vitral-ssr]')
  window.__doServidor = slot && slot.shadowRoot && slot.shadowRoot.querySelector('button')
</script>
<script type="module">
  import { configure } from '/vitral/index.js'
  import { defineVitralElement } from '/vitral/element.js'
  configure({ retries: 0, remotes: { ssr: '/_vitral/ssr/vitral.json' } })
  defineVitralElement()
</script>
</body></html>`

const TYPES: Record<string, string> = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8' }

let origin: Server
let edge: Server
let base = ''
let manifest = ''

const listen = (server: Server) => new Promise<number>((ok) => server.listen(0, () => ok((server.address() as AddressInfo).port)))

test.beforeAll(async () => {
  // Host: a página e a lib.
  origin = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://x').pathname
    if (path.startsWith('/vitral/')) {
      const file = join(dist, path.slice('/vitral/'.length).replace(/\.\./g, ''))
      const body = await readFile(file).catch(() => null)
      if (!body) return void res.writeHead(404).end()
      return void res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/plain' }).end(body)
    }
    res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' }).end(PAGE)
  })
  const hostPort = await listen(origin)
  manifest = cdn('ssr')
  edge = createServer(
    toNodeListener(
      gateway({
        origin: `http://localhost:${hostPort}`,
        remotes: { ssr: { url: manifest, render } },
        isolate: 'shadow',
        preload: () => ['ssr'],
      }),
    ),
  )
  base = `http://localhost:${await listen(edge)}`
})

test.afterAll(() => {
  origin?.close()
  edge?.close()
})

function watch(page: Page) {
  const erros: string[] = []
  const urls: string[] = []
  // Os testes do SRI (`core/sri.ts`) carregam de propósito um módulo com hash
  // errado (`blob:` ou `data:`, conforme o caminho) e, onde import maps
  // tardios são recusados, um mapa recusado; cada navegador registra isso do
  // seu jeito. Nada mais pode ir para o console.
  const sonda = (t: string) => /integrity|import ?map/i.test(t)
  page.on('console', (m) => m.type() === 'error' && !sonda(m.text()) && erros.push(m.text()))
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('request', (r) => urls.push(r.url()))
  return { erros, urls }
}

test('HTML do remote no shadow root antes de qualquer JS', async ({ page }) => {
  // Sem a lib: o que aparece é só o que o gateway escreveu. As requisições
  // barradas aqui deixam erros no console, por isso este teste não os confere.
  await page.route('**/vitral/**', (route) => route.abort())
  await page.route('**/_vitral/**', (route) => route.abort())
  await page.goto(base)
  const button = page.locator('vitral-remote button.ssr')
  await expect(button).toHaveText('itens: 3')
  // CSS do remote dentro do shadow root.
  await expect(button).toHaveCSS('color', 'rgb(0, 0, 255)')
  await expect(page.getByText('Carregando…')).toBeHidden()
  expect(await page.evaluate(() => !!(window as any).__doServidor)).toBe(true)
  // O JS do remote não rodou: o HTML é o do servidor.
  expect(await page.evaluate(() => (window as any).__chamadas)).toBeUndefined()
})

test('hidrata sem remontar, tudo de uma origem só', async ({ page }) => {
  const { erros, urls } = watch(page)
  await page.goto(base)
  const remote = page.locator('vitral-remote')
  await expect(remote).toHaveAttribute('data-vitral-status', 'ready')
  expect(await page.evaluate(() => (window as any).__chamadas)).toEqual(['hydrate'])
  // O mesmo nó que veio do servidor, agora com o handler do remote.
  const same = await page.evaluate(() => {
    const b = (window as any).__doServidor as HTMLButtonElement
    const slot = document.querySelector('vitral-remote [data-vitral-ssr]')!
    return b.isConnected && slot.shadowRoot!.querySelector('button') === b
  })
  expect(same).toBe(true)
  const button = page.locator('vitral-remote button.ssr')
  await button.click()
  await expect(button).toHaveText('itens: 4')
  await expect(button).toHaveCSS('color', 'rgb(0, 0, 255)')
  // Props novas chegam pelo update do remote hidratado.
  await page.evaluate(() => ((document.querySelector('vitral-remote') as any).props = { n: 10 }))
  await expect(button).toHaveText('itens: 10')
  await expect(page.getByText('Carregando…')).toBeHidden()
  // Fora os módulos `data:` com que a lib testa o SRI do navegador.
  expect(urls.filter((u) => /^https?:/.test(u) && !u.startsWith(base))).toEqual([])
  expect(urls.some((u) => u.includes('/_vitral/ssr/'))).toBe(true)
  expect(erros).toEqual([])
})

test('manifesto na mesma origem e Link para os arquivos do remote', async ({ request }) => {
  const res = await request.get(base)
  const link = res.headers()['link']
  expect(link).toMatch(/<\/_vitral\/ssr\/remote-[0-9a-f]{8}\.js>; rel=preload; as=fetch; crossorigin=anonymous/)
  expect(link).toContain('/_vitral/ssr/remote-')
  const own = await (await request.get(`${base}/_vitral/ssr/vitral.json`)).json()
  const upstream = await (await request.get(manifest)).json()
  // Caminhos relativos ficam iguais; o hash também.
  expect(own.entry).toBe(upstream.entry)
  expect(own.integrity).toBe(upstream.integrity)
})
