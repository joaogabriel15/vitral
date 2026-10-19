// vitral/vitals num navegador de verdade: o layout shift de um remote vai para ele.
// Layout shift e Soft Navigations só existem no Chromium; nos outros, nada quebra
// e nenhum relatório sai com o dono errado.
import { chromium, expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../packages/vitral/dist/', import.meta.url))

// Com `shift`, o remote insere um bloco acima do próprio texto 700 ms (fora dos 500 ms de "input recente") depois de montar.
const REMOTE = `
export default {
  mount(el, props) {
    el.innerHTML = '<p class="texto" style="margin:0;height:40px">' + props.msg + '</p>'
    if (props.shift) setTimeout(() => {
      const bloco = document.createElement('div')
      bloco.style.height = '200px'
      el.prepend(bloco)
      requestAnimationFrame(() => requestAnimationFrame(() => (window.__shifted = true)))
    }, 700)
    return { unmount() { el.innerHTML = '' } }
  },
}
`

const PAGE = `<!doctype html><body style="margin:0">
<div id="menu" style="height:60px"></div>
<button id="ir" style="height:30px">busca</button>
<h1 id="titulo" style="margin:0;height:40px">loja</h1>
<div id="anuncio"></div>
<script type="module">
  import { configure, mountRemote } from '/vitral/index.js'
  import { vitals } from '/vitral/vitals.js'
  window.__reports = []
  window.__stop = vitals({ onReport: (r) => window.__reports.push(r) })
  configure({ remotes: { menu: '/r/menu/vitral.json', anuncio: '/r/anuncio/vitral.json', busca: '/r/busca/vitral.json' } })
  await mountRemote(document.getElementById('menu'), 'menu', { msg: 'menu' })
  if (location.search == '?shift') await mountRemote(document.getElementById('anuncio'), 'anuncio', { msg: 'anúncio', shift: true })
  document.getElementById('ir').addEventListener('click', () => {
    history.pushState({}, '', '/busca')
    document.getElementById('titulo').textContent = 'busca'
    const alvo = document.body.appendChild(document.createElement('div'))
    mountRemote(alvo, 'busca', { msg: 'resultados', shift: true })
  })
  window.__ready = true
</script></body>`

let server: Server
let origin = ''

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://x').pathname
    if (path === '/' || path === '/busca') return void res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE)
    if (path.startsWith('/vitral/')) {
      try {
        return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(await readFile(join(dist, path.slice(8))))
      } catch {
        return void res.writeHead(404).end()
      }
    }
    const remote = path.match(/^\/r\/(\w+)\/vitral\.json$/)?.[1]
    if (remote) return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ name: remote, version: '2.0.0', entry: 'remote.js' }))
    if (path.endsWith('/remote.js')) return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(REMOTE)
    res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
test.afterAll(() => server?.close())

type Report = { name: string; remote?: string; version?: string; route: string; navigationId?: string; value: number; rating: string }

/** Erros de console e de página: o runtime não pode escrever nenhum. */
function errors(page: Page) {
  const list: string[] = []
  page.on('console', (m) => m.type() === 'error' && list.push(m.text()))
  page.on('pageerror', (e) => list.push(String(e)))
  return list
}

/** Espera o shift do remote, chama `stop()` e devolve os relatórios. */
async function reports(page: Page): Promise<Report[]> {
  await page.waitForFunction(() => (window as any).__shifted)
  return page.evaluate(() => ((window as any).__stop(), (window as any).__reports))
}

test('layout shift causado por um remote é atribuído a ele', async ({ page, browserName }) => {
  const errs = errors(page)
  await page.goto(origin + '/?shift')
  await page.waitForFunction(() => (window as any).__ready)
  const all = await reports(page)
  const cls = all.filter((r) => r.name === 'CLS')
  // Nenhum navegador relata o shift com outro dono.
  for (const r of cls) expect(r).toMatchObject({ remote: 'anuncio', version: '2.0.0', route: '/' })
  expect(all.filter((r) => r.remote === 'menu' && r.name !== 'LCP')).toEqual([])
  for (const r of all) {
    expect(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']).toContain(r.name)
    expect(r.value).toBeGreaterThanOrEqual(0)
    expect(['good', 'needs-improvement', 'poor']).toContain(r.rating)
  }
  if (browserName === 'chromium') {
    expect(cls).toHaveLength(1)
    expect(cls[0].value).toBeGreaterThan(0)
  }
  expect(errs).toEqual([])
})

test('a rota do relatório é a da navegação em que o shift aconteceu', async ({ page, browserName }) => {
  const errs = errors(page)
  await page.goto(origin)
  await page.waitForFunction(() => (window as any).__ready)
  await page.click('#ir')
  const cls = (await reports(page)).filter((r) => r.name === 'CLS')
  for (const r of cls) expect(r).toMatchObject({ remote: 'busca', route: '/busca' })
  if (browserName === 'chromium') expect(cls).toHaveLength(1)
  expect(errs).toEqual([])
})

test('Chromium com Soft Navigations: o shift traz o navigationId da navegação soft', async ({ browserName }) => {
  // Só o Chromium tem a flag. Nos outros, o teste anterior cobre a rota por pathname.
  if (browserName !== 'chromium') return
  const browser = await chromium.launch({ args: ['--enable-features=SoftNavigationHeuristics'] })
  try {
    const page = await browser.newPage()
    const errs = errors(page)
    await page.goto(origin)
    await page.waitForFunction(() => (window as any).__ready)
    const first = await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as any).navigationId)
    await page.click('#ir')
    await page.waitForFunction(() => performance.getEntriesByType('soft-navigation').length > 0)
    const all = await reports(page)
    const cls = all.filter((r) => r.name === 'CLS')
    expect(cls).toHaveLength(1)
    expect(cls[0]).toMatchObject({ remote: 'busca', version: '2.0.0', route: '/busca' })
    expect(cls[0].navigationId).toBeTruthy()
    expect(cls[0].navigationId).not.toBe(String(first))
    expect(errs).toEqual([])
  } finally {
    await browser.close()
  }
})
