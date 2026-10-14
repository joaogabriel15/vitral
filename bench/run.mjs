// Benchmark do vitral: host com 3 remotes React e 1 Vue, em 4G simulado.
//
//   node bench/run.mjs [--root <repo>] [--out <arquivo.json>] [--runs 5]
//
// Mede (mediana de --runs):
// - coldReadyMs: tempo até os 4 remotes prontos, cache vazio
// - warmReadyMs: o mesmo com cache HTTP cheio (segunda visita)
// - jsKB: JS transferido na visita fria (comprimido)
// - heapGrowthKB: heap a mais depois de 100 ciclos de desmontar e montar
//   (após 20 de aquecimento)
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { startServer } from './server.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const { values: args } = parseArgs({
  options: { root: { type: 'string', default: resolve(here, '..') }, out: { type: 'string' }, runs: { type: 'string', default: '5' }, cycles: { type: 'string', default: '100' } },
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

const server = await startServer(args.root)
const browser = await chromium.launch()
const cold = []
const warm = []
const js = []
const heap = []
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
console.log(JSON.stringify(result, null, 2))
if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n')
