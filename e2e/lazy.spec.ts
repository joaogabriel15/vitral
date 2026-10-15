// loading="lazy", prefetch e keep-alive no <vitral-remote>, num navegador de verdade.
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../packages/vitral/dist/', import.meta.url))

const REMOTE = `
let mounts = 0
export default {
  mount(el, props, ctx) {
    mounts++
    let clicks = 0
    const log = (window.__log ||= [])
    ctx.onActivate?.(() => log.push('ativo'))
    ctx.onDeactivate?.(() => log.push('pausado'))
    const draw = (p) => (el.innerHTML = '<button class="ping">' + p.msg + ' ' + clicks + ' (montagens: ' + mounts + ')</button>')
    el.addEventListener('click', () => (clicks++, draw(props)))
    draw(props)
    return { update: (p) => ((props = p), draw(p)), unmount() { el.innerHTML = '' } }
  },
}
`

const PAGE = `<!doctype html><body>
<div id="topo"><vitral-remote id="aba" name="aba" props='{"msg":"aba"}' keep-alive></vitral-remote></div>
<div style="height:5000px"></div>
<vitral-remote id="longe" name="longe" props='{"msg":"longe"}' loading="lazy" style="display:block;min-height:50px"></vitral-remote>
<div style="height:5000px"></div>
<vitral-remote name="hover" loading="lazy" prefetch="hover" style="display:block;min-height:40px"></vitral-remote>
<script type="module">
  import { configure } from '/vitral/index.js'
  import { defineVitralElement } from '/vitral/element.js'
  configure({ remotes: { aba: '/r/aba/vitral.json', longe: '/r/longe/vitral.json', hover: '/r/hover/vitral.json' } })
  defineVitralElement()
</script></body>`

let server: Server
let origin = ''
const requests: string[] = []

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://x').pathname
    requests.push(path)
    if (path === '/') return void res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE)
    if (path.startsWith('/vitral/')) {
      try {
        return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(await readFile(join(dist, path.slice(8))))
      } catch {
        return void res.writeHead(404).end()
      }
    }
    if (path.endsWith('/vitral.json')) return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ name: 'r', entry: 'remote.js' }))
    if (path.endsWith('/remote.js')) return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(REMOTE)
    res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
test.afterAll(() => server?.close())

test('loading="lazy" fora da tela não faz requisição antes da rolagem', async ({ page }) => {
  requests.length = 0
  await page.goto(origin)
  await expect(page.locator('#aba .ping')).toBeVisible()
  await page.waitForTimeout(300)
  expect(requests.filter((p) => p.startsWith('/r/longe/'))).toEqual([])
  await page.locator('#longe').scrollIntoViewIfNeeded()
  await expect(page.locator('#longe .ping')).toHaveText(/longe/)
  expect(requests.filter((p) => p.startsWith('/r/longe/'))).toEqual(['/r/longe/vitral.json', '/r/longe/remote.js'])
})

test('prefetch="hover" baixa no hover, antes de montar', async ({ page }) => {
  requests.length = 0
  // Fora da tela de propósito: só o hover pode disparar o download.
  await page.goto(origin)
  await page.waitForTimeout(300)
  expect(requests.filter((p) => p.startsWith('/r/hover/'))).toEqual([])
  await page.evaluate(() => document.querySelector('vitral-remote[name="hover"]')!.dispatchEvent(new Event('pointerenter')))
  await expect.poll(() => requests.filter((p) => p.startsWith('/r/hover/'))).toEqual(['/r/hover/vitral.json', '/r/hover/remote.js'])
  expect(await page.locator('vitral-remote[name="hover"] .ping').count()).toBe(0)
})

test('keep-alive: tirar e pôr de volta não remonta e mantém o estado', async ({ page }) => {
  await page.goto(origin)
  await page.locator('#aba .ping').click()
  await expect(page.locator('#aba .ping')).toHaveText('aba 1 (montagens: 1)')
  // Troca de "rota": o elemento sai da página e um novo entra depois.
  await page.evaluate(() => document.getElementById('aba')!.remove())
  await page.waitForTimeout(50)
  expect(await page.evaluate(() => (window as any).__log)).toEqual(['pausado'])
  await page.evaluate(() => {
    const el = document.createElement('vitral-remote')
    el.id = 'aba2'
    el.setAttribute('name', 'aba')
    el.setAttribute('keep-alive', '')
    el.setAttribute('props', '{"msg":"de volta"}')
    document.getElementById('topo')!.append(el)
  })
  await expect(page.locator('#aba2 .ping')).toHaveText('de volta 1 (montagens: 1)')
  expect(await page.evaluate(() => (window as any).__log)).toEqual(['pausado', 'ativo'])
  await expect(page.locator('#aba2')).toHaveAttribute('data-vitral-status', 'ready')
})
