// Bateria de vazamento de memória (noturna, .github/workflows/memoria.yml).
//
//   pnpm build && pnpm --filter './examples/remotes/**' build
//   node e2e/memoria/run.mjs [--ciclos 500] [--aquecimento 100] [--so react,remote:vue] [--out memoria.json]
//
// Para cada adaptador de host (montando o remote "cartao") e cada remote de
// examples/ (montado por createSlot): aquece, mede, faz --ciclos de montar e
// desmontar e mede de novo, no Chromium pelo CDP. Falha se:
// - algum tipo de objeto do heap (construtor) cresce --ciclos/10 ou mais: um
//   objeto preso por ciclo apareceria como +ciclos;
// - sobram nós de DOM soltos (detached), nós no documento ou listeners;
// - o heap cresce mais de 2 KB por ciclo. O tamanho sozinho engana: nas primeiras
//   centenas de ciclos o V8 compila código (~1 KB/ciclo), por isso o aquecimento
//   e a comparação por tipo, que ignora código compilado, é a que vale.
// Antes, um adaptador de controle que vaza de propósito precisa ser pego.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { build } from 'vite'
import { CDN, HOST, start } from '../fixtures/server.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const { values: args } = parseArgs({
  options: {
    ciclos: { type: 'string', default: '500' },
    aquecimento: { type: 'string', default: '100' },
    so: { type: 'string' },
    out: { type: 'string' },
  },
})
const CICLOS = Number(args.ciclos)
const AQUECIMENTO = Number(args.aquecimento)
const LIMITE_TIPO = Math.max(10, Math.floor(CICLOS / 10))
const LIMITE_HEAP_KB = 2 * CICLOS
const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']

const cdn = (remote) => `http://localhost:${CDN}/c/${Buffer.from(JSON.stringify({ id: 'memoria' })).toString('base64url')}/${remote}/vitral.json`

// Tipos de nó do heap que são objetos do programa (fora código, strings e internos do V8).
const TIPOS = new Set(['object', 'closure', 'native', 'regexp'])

/** Conta os objetos do heap por tipo e construtor, e os nós de DOM soltos. */
async function contarObjetos(cdp) {
  const chunks = []
  const onChunk = (e) => chunks.push(e.chunk)
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false })
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  const snap = JSON.parse(chunks.join(''))
  const { node_fields: fields, node_types: [types] } = snap.snapshot.meta
  const [iType, iName, iDetached] = ['type', 'name', 'detachedness'].map((f) => fields.indexOf(f))
  const contagem = new Map()
  let soltos = 0
  for (let i = 0; i < snap.nodes.length; i += fields.length) {
    const tipo = types[snap.nodes[i + iType]]
    if (!TIPOS.has(tipo)) continue
    const chave = `${tipo}:${snap.strings[snap.nodes[i + iName]]}`
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
    if (iDetached >= 0 && snap.nodes[i + iDetached] === 2) soltos++
  }
  return { contagem, soltos }
}

async function medir(cdp) {
  for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  const dom = await cdp.send('Memory.getDOMCounters')
  return { heap: usedSize, dom, ...(await contarObjetos(cdp)) }
}

async function testar(browser, adaptador) {
  const page = await browser.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  await page.goto(`http://localhost:${HOST}/memoria/`)
  await page.waitForFunction(() => window.__pronto)
  const remotes = Object.fromEntries([['cartao', cdn('cartao')], ...REMOTES.map((r) => [r, cdn(`ex-${r}`)])])
  await page.evaluate((r) => window.vitral.configure({ remotes: r }), remotes)

  await page.evaluate(([a, n]) => window.ciclar(a, n), [adaptador, AQUECIMENTO])
  const antes = await medir(cdp)
  const t0 = Date.now()
  const sobrou = await page.evaluate(([a, n]) => window.ciclar(a, n), [adaptador, CICLOS])
  const ms = Date.now() - t0
  const depois = await medir(cdp)
  await page.close()

  const cresceram = [...depois.contagem]
    .map(([tipo, n]) => [tipo, n - (antes.contagem.get(tipo) ?? 0)])
    .filter(([, d]) => d >= LIMITE_TIPO)
    .sort((a, b) => b[1] - a[1])
  const r = {
    adaptador,
    msPorCiclo: Math.round((ms / CICLOS) * 10) / 10,
    heapKB: Math.round((depois.heap - antes.heap) / 102.4) / 10,
    nos: depois.dom.nodes - antes.dom.nodes,
    listeners: depois.dom.jsEventListeners - antes.dom.jsEventListeners,
    soltos: depois.soltos - antes.soltos,
    cresceram: Object.fromEntries(cresceram.slice(0, 10)),
    sobrou,
    erros,
  }
  const falhas = []
  if (erros.length) falhas.push(`erros na página: ${erros.join('; ')}`)
  if (sobrou) falhas.push(`${sobrou} remotes ainda montados`)
  if (cresceram.length) falhas.push(`objetos acumulando: ${cresceram.map(([t, d]) => `${t} +${d}`).join(', ')}`)
  if (r.soltos >= LIMITE_TIPO) falhas.push(`${r.soltos} nós de DOM soltos`)
  if (r.nos >= LIMITE_TIPO) falhas.push(`${r.nos} nós de DOM a mais`)
  if (r.listeners >= LIMITE_TIPO) falhas.push(`${r.listeners} listeners a mais`)
  if (r.heapKB > LIMITE_HEAP_KB) falhas.push(`heap cresceu ${r.heapKB} KB (limite ${LIMITE_HEAP_KB} KB)`)
  return { ...r, falhas }
}

await build({ root: here, base: '/memoria/', logLevel: 'error', build: { outDir: 'dist', emptyOutDir: true } })
const servers = start()
const browser = await chromium.launch()
const resultados = []
try {
  const hosts = await (async () => {
    const page = await browser.newPage()
    await page.goto(`http://localhost:${HOST}/memoria/`)
    await page.waitForFunction(() => window.__pronto)
    const h = await page.evaluate(() => window.HOSTS)
    await page.close()
    return h
  })()
  // O controle vaza de propósito: se a bateria não pegar, ela não serve.
  const controle = await testar(browser, 'vazando')
  console.error(`controle: ${controle.falhas.join('; ') || 'nenhuma falha'}`)
  if (!Object.keys(controle.cresceram).length || controle.soltos < LIMITE_TIPO || controle.listeners < LIMITE_TIPO) {
    throw new Error('a bateria não detectou o vazamento de controle (objetos, nós soltos e listeners)')
  }
  const todos = [...hosts, ...REMOTES.map((r) => `remote:${r}`)]
  const escolhidos = args.so ? args.so.split(',') : todos
  for (const adaptador of escolhidos) {
    const r = await testar(browser, adaptador)
    console.error(`${r.falhas.length ? 'FALHOU' : 'ok'}  ${adaptador}  heap ${r.heapKB} KB, nós ${r.nos}, soltos ${r.soltos}, listeners ${r.listeners}${r.falhas.length ? `\n  ${r.falhas.join('\n  ')}` : ''}`)
    resultados.push(r)
  }
} finally {
  await browser.close()
  for (const s of servers) s.close()
}

const linhas = resultados.map((r) => `| ${r.adaptador} | ${r.falhas.length ? 'falhou' : 'ok'} | ${r.heapKB} | ${r.nos} | ${r.soltos} | ${r.listeners} | ${r.msPorCiclo} | ${r.falhas.join('; ') || '-'} |`)
console.log(`## Vazamento de memória (${CICLOS} ciclos, depois de ${AQUECIMENTO} de aquecimento)

| Adaptador | Resultado | Heap (KB) | Nós de DOM | Nós soltos | Listeners | ms/ciclo | Falhas |
| --- | --- | --- | --- | --- | --- | --- | --- |
${linhas.join('\n')}
`)
if (args.out) writeFileSync(args.out, JSON.stringify({ ciclos: CICLOS, aquecimento: AQUECIMENTO, resultados }, null, 2) + '\n')
if (resultados.some((r) => r.falhas.length)) process.exit(1)
