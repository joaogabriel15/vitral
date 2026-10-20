// Dicionários de compressão (vitral dict + vitral/dict) num navegador de verdade.
// O deploy 1 sai com Use-As-Dictionary; no deploy 2 o navegador manda
// Available-Dictionary e recebe o delta em dcz ou dcb, e o módulo roda igual.
// Navegador sem suporte (Firefox e WebKit hoje) recebe o arquivo normal.
import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDict, type DictIndex } from '../packages/vitral/dist/dict.js'

const cli = fileURLToPath(new URL('../packages/vitral/dist/cli.js', import.meta.url))
const remote = (v: number) =>
  `export const versao = ${v}\nexport function mount(el) { el.textContent = 'deploy ' + versao }\n` +
  Array.from({ length: 300 }, (_, i) => `export const f${i} = (x) => x * ${i} + "texto que se repete entre deploys ${i}"\n`).join('')

let dir: string
let server: Server
let url: string
const pedidos: { path: string; dict?: string }[] = []

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vitral-dict-e2e-'))
  for (const [v, nome] of [
    [1, 'remote-AAAAAAAA.js'],
    [2, 'remote-BBBBBBBB.js'],
  ] as const) {
    mkdirSync(join(dir, `v${v}`))
    writeFileSync(join(dir, `v${v}`, nome), remote(v))
  }
  execFileSync(process.execPath, [cli, 'dict', join(dir, 'v2'), '--from', join(dir, 'v1')], { stdio: 'pipe' })
  const index: DictIndex = JSON.parse(readFileSync(join(dir, 'v2/vitral-dict.json'), 'utf8'))
  // Os dois deploys servidos no mesmo lugar, como numa CDN que guarda as versões.
  index.files['remote-AAAAAAAA.js'] = { type: 'text/javascript', deltas: {} }
  const dict = createDict({ index, base: '/chat/', read: (p) => readFileSync(join(dir, 'v2', p)) })
  server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://x').pathname
    if (path === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end('<!doctype html><div id="slot"></div>')
    }
    if (path.startsWith('/chat/')) {
      pedidos.push({ path, dict: req.headers['available-dictionary'] as string | undefined })
      return dict.node(req, res, () => {
        const file = ['v2', 'v1'].map((v) => join(dir, v, path.slice(6))).find(existsSync)
        if (!file) return res.writeHead(404).end()
        res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' })
        res.end(readFileSync(file))
      })
    }
    res.writeHead(404).end()
  })
  await new Promise<void>((r) => server.listen(0, r))
  url = `http://localhost:${(server.address() as { port: number }).port}`
})

test.afterAll(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('deploy 2 chega como delta do deploy 1 e o remote monta', async ({ page, browserName }) => {
  const encodings: string[] = []
  page.on('response', (r) => r.url().includes('/remote-BBBBBBBB.js') && encodings.push(r.headers()['content-encoding'] ?? ''))
  await page.goto(url)
  const v1 = await page.evaluate(async () => {
    const m = await import('/chat/remote-AAAAAAAA.js')
    m.mount(document.getElementById('slot'))
    return document.getElementById('slot')!.textContent
  })
  expect(v1).toBe('deploy 1')
  // O dicionário é gravado depois da resposta: um pedido logo em seguida pode sair sem ele.
  // Cada tentativa usa outra URL (?n=) para o navegador pedir de novo.
  for (let n = 0; n < 10; n++) {
    const v = await page.evaluate(async (n) => {
      const m = await import(`/chat/remote-BBBBBBBB.js?n=${n}`)
      m.mount(document.getElementById('slot'))
      return document.getElementById('slot')!.textContent
    }, n)
    expect(v).toBe('deploy 2')
    if (browserName !== 'chromium' || pedidos.at(-1)!.dict) break
    await page.waitForTimeout(200)
  }
  if (browserName === 'chromium') expect(pedidos.at(-1)!.dict).toBeTruthy()
  await expect.poll(() => encodings.length).toBe(pedidos.filter((p) => p.path.endsWith('/remote-BBBBBBBB.js')).length)
  // dcz quando o navegador aceita (o Chromium aceita), senão a resposta normal.
  expect(encodings.at(-1)).toBe(pedidos.at(-1)!.dict ? 'dcz' : '')
})
