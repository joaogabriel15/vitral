// Benchmark do vitral: host com 3 remotes React e 1 Vue, em 4G simulado.
//
//   node bench/run.mjs [--root <repo>] [--out <arquivo.json>] [--runs 5] [--prefetch]
//
// Mede (mediana de --runs):
// - coldReadyMs: tempo até os 4 remotes prontos, cache vazio
// - warmReadyMs: o mesmo com cache HTTP cheio (segunda visita)
// - jsKB: JS transferido na visita fria (comprimido)
// - heapGrowthKB: heap a mais depois de 100 ciclos de desmontar e montar
//   (após 20 de aquecimento)
// Com --prefetch, também (rotas.html: /rotas/a monta react1, /rotas/b monta vue1):
// - nextReadyMs: tempo de navegar de A até B pronto, com cache vazio
// - nextReadyPrefetchMs: o mesmo com vitral/prefetch treinado (A → B 3 vezes)
//   e depois de o prefetch de B terminar na rota A
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { startServer } from './server.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const { values: args } = parseArgs({
  options: { root: { type: 'string', default: resolve(here, '..') }, out: { type: 'string' }, runs: { type: 'string', default: '5' }, cycles: { type: 'string', default: '100' }, prefetch: { type: 'boolean', default: false } },
})
const RUNS = Number(args.runs)
const CYCLES = Number(args.cycles)

// "Slow 4G" do Lighthouse: 150 ms de RTT, 1,6 Mbps de download, 750 kbps de upload.
const NET = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (n) => Math.round(n * 10) / 10

async function openPage(context) {
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', NET)
  const urls = new Map()
  let jsBytes = 0
  cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url))
  cdp.on('Network.loadingFinished', (e) => {
    if (/\.m?js(\?|$)/.test(urls.get(e.requestId) ?? '')) jsBytes += e.encodedDataLength
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { page, cdp, js: () => jsBytes, errors }
}

async function visit(context, url) {
  const p = await openPage(context)
  await p.page.goto(url)
  await p.page.waitForFunction(() => window.__ready, null, { timeout: 60_000 })
  if (p.errors.length) throw new Error(`erros na página: ${p.errors.join('; ')}`)
  return { ...p, ready: await p.page.evaluate(() => window.__ready) }
}

/** Tempo de A até B pronto, numa visita com cache vazio. Com `prefetch`, treina antes. */
async function nextReady(browser, base, prefetch) {
  const q = prefetch ? '?prefetch' : ''
  let storageState
  if (prefetch) {
    const training = await browser.newContext()
    const page = await training.newPage()
    await page.goto(`${base}/rotas/a${q}`)
    await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 })
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__go('/rotas/b'))
      await page.evaluate(() => window.__go('/rotas/a'))
    }
    storageState = await training.storageState()
    await training.close()
  }
  const context = await browser.newContext({ storageState })
  const { page, errors } = await openPage(context)
  await page.goto(`${base}/rotas/a${q}`)
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 })
  if (prefetch) await page.waitForFunction(() => window.__prefetched.includes('vue1'), null, { timeout: 60_000 })
  // Tempo de leitura da página A, igual nos dois casos.
  await page.waitForTimeout(500)
  const ms = await page.evaluate(() => window.__go('/rotas/b'))
  if (errors.length) throw new Error(`erros na página: ${errors.join('; ')}`)
  await context.close()
  return ms
}

const server = await startServer(args.root)
const browser = await chromium.launch()
const cold = []
const warm = []
const js = []
const heap = []
const next = []
const nextPrefetch = []
try {
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext()
    const first = await visit(context, server.url)
    cold.push(first.ready)
    js.push(first.js())
    await first.page.close()
    const second = await visit(context, server.url)
    warm.push(second.ready)

    // Memória: ciclos sem rede lenta, GC forçado antes e depois. Os 20 ciclos
    // de aquecimento tiram da conta o código que o V8 compila nas primeiras vezes.
    await second.cdp.send('Network.emulateNetworkConditions', { ...NET, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await second.page.evaluate(() => window.__cycle(20))
    await second.cdp.send('HeapProfiler.collectGarbage')
    const before = (await second.cdp.send('Runtime.getHeapUsage')).usedSize
    const roots = await second.page.evaluate((n) => window.__cycle(n), CYCLES)
    if (roots !== 4) throw new Error(`esperava 4 remotes montados, achou ${roots}`)
    await second.cdp.send('HeapProfiler.collectGarbage')
    const after = (await second.cdp.send('Runtime.getHeapUsage')).usedSize
    heap.push(after - before)
    await context.close()
    if (args.prefetch) {
      next.push(await nextReady(browser, server.url, false))
      nextPrefetch.push(await nextReady(browser, server.url, true))
    }
  }
} finally {
  await browser.close()
  server.close()
}

const result = {
  scenario: '3 React + 1 Vue, Slow 4G, Chromium',
  runs: RUNS,
  coldReadyMs: round(median(cold)),
  warmReadyMs: round(median(warm)),
  jsKB: round(median(js) / 1024),
  heapGrowthKB: round(median(heap) / 1024),
}
if (args.prefetch) Object.assign(result, { nextReadyMs: round(median(next)), nextReadyPrefetchMs: round(median(nextPrefetch)) })
console.log(JSON.stringify(result, null, 2))
if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n')
