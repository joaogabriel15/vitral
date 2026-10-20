// Benchmark público: host do vitral contra o runtime do Module Federation,
// com os mesmos N remotes (3 React para cada Vue), no Chromium com rede fixa.
//
//   pnpm build && node bench/publico/run.mjs [--n 1,4,8] [--runs 7] [--only id,id] [--cpu 4]
//                                            [--work <pasta>] [--out <arquivo.json>] [--sem-build] [--servir]
//
// --sem-build reaproveita o build da pasta de trabalho. --servir só sobe o
// servidor (porta 4301), para abrir /host-vitral/?remotes=vitral-dedupe&n=4 no navegador.
//
// Instala as versões fixadas abaixo numa pasta de trabalho (não mexe no
// lockfile), constrói hosts e remotes com o Vite, serve tudo com brotli e
// mede no Chromium do Playwright. Não roda no CI e não muda bench/baseline.json.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, platform, release, totalmem } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { brotliCompressSync, constants } from 'node:zlib'
import { chromium } from 'playwright'
import { cenarios } from './cenarios.mjs'

// Versões medidas. Mudou uma, rode de novo e atualize a página de docs.
const VERSOES = {
  vite: '8.3.4',
  '@vitejs/plugin-react': '6.1.2',
  '@vitejs/plugin-vue': '6.0.10',
  react: '19.3.0',
  'react-dom': '19.3.0',
  vue: '3.5.44',
  '@module-federation/vite': '1.23.5',
  '@module-federation/runtime': '2.9.2',
}

// "Slow 4G" do Lighthouse, a mesma rede do bench do CI: 150 ms de RTT,
// 1,6 Mbps de download, 750 kbps de upload.
const REDE = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }

const here = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(here, '../..')
const { values: args } = parseArgs({
  options: {
    n: { type: 'string', default: '1,4,8' },
    runs: { type: 'string', default: '7' },
    only: { type: 'string' },
    work: { type: 'string', default: join(here, '../node_modules/.cache/publico') },
    out: { type: 'string', default: join(here, 'resultado.json') },
    cpu: { type: 'string', default: '1' },
    'sem-build': { type: 'boolean', default: false },
    servir: { type: 'boolean', default: false },
  },
})
const NS = args.n.split(',').map(Number)
const RUNS = Number(args.runs)
const CPU = Number(args.cpu)
const lista = args.only ? cenarios.filter((c) => args.only.split(',').includes(c.id)) : cenarios
const work = resolve(args.work)
const out = join(work, 'out')

// ---------- preparo: instala e constrói ----------

const vitralDir = join(root, 'packages/vitral')
if (!existsSync(join(vitralDir, 'dist/index.js'))) {
  console.error('Rode `pnpm build` antes: falta packages/vitral/dist/index.js')
  process.exit(1)
}

function instalar() {
  mkdirSync(work, { recursive: true })
  // O vitral entra pelo tarball do pacote, como um usuário instala.
  rmSync(join(work, 'pacote'), { recursive: true, force: true })
  execFileSync('pnpm', ['pack', '--pack-destination', join(work, 'pacote')], { cwd: vitralDir, stdio: 'ignore' })
  const tgz = join(work, 'pacote', execFileSync('ls', [join(work, 'pacote')]).toString().trim())
  const deps = { ...VERSOES, vitral: `file:${tgz}` }
  const pkg = { name: 'bench-publico-work', private: true, type: 'module', dependencies: deps }
  const atual = existsSync(join(work, 'package.json')) && readFileSync(join(work, 'package.json'), 'utf8')
  writeFileSync(join(work, 'package.json'), JSON.stringify(pkg, null, 2))
  // Reinstala o vitral sempre (o tarball muda a cada build); o resto só quando as versões mudam.
  if (atual !== JSON.stringify(pkg, null, 2) || !existsSync(join(work, 'node_modules'))) {
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-package-lock'], { cwd: work, stdio: 'inherit' })
  } else {
    // Mesma versão no tarball novo: o npm reaproveita a cópia do cache dele.
    // Extrai o tarball direto (as dependências do vitral já estão instaladas).
    const dir = join(work, 'node_modules/vitral')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir)
    execFileSync('tar', ['xzf', tgz, '-C', dir, '--strip-components=1'])
  }
  rmSync(join(work, 'src'), { recursive: true, force: true })
  cpSync(join(here, 'fontes'), join(work, 'src'), { recursive: true })
  // O build do @module-federation/vite parte de um index.html, mesmo num remote sem página.
  writeFileSync(join(work, 'index.html'), '<!doctype html><title>remote</title>\n')
}


async function construir() {
  // Importa de dentro da pasta de trabalho, para resolver com as condições de ESM.
  writeFileSync(
    join(work, 'ferramentas.mjs'),
    `export { build } from 'vite'\nexport { default as react } from '@vitejs/plugin-react'\nexport { default as vue } from '@vitejs/plugin-vue'\nexport { default as vitral } from 'vitral/vite'\nexport { federation } from '@module-federation/vite'\n`,
  )
  const { build, react, vue, vitral, federation } = await import(pathToFileURL(join(work, 'ferramentas.mjs')).href)
  const max = Math.max(...NS)
  const { remotes } = await import(pathToFileURL(join(here, 'fontes/lista.js')).href)
  const base = { configFile: false, root: work, logLevel: 'warn', base: './' }

  for (const host of new Set(lista.map((c) => c.host))) {
    const dir = join(work, `host-${host}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir)
    cpSync(join(here, 'fontes/index.html'), join(dir, 'index.html'))
    cpSync(join(here, 'fontes/lista.js'), join(dir, 'lista.js'))
    cpSync(join(here, `fontes/host-${host}.js`), join(dir, 'host.js'))
    await build({ ...base, root: dir, base: `/host-${host}/`, build: { outDir: join(out, `host-${host}`), emptyOutDir: true, target: 'es2022' } })
  }

  for (const c of lista) {
    for (const nome of remotes(max)) {
      const fw = nome.startsWith('vue') ? 'vue' : 'react'
      const outDir = join(out, c.id, nome)
      let plugins
      if (c.ferramenta === 'vitral') {
        let opcoes = { entry: `src/Cartao.${fw === 'vue' ? 'vue' : 'jsx'}`, name: nome, ...(c.compartilha && { dedupe: [fw] }) }
        if (c.build) opcoes = c.build('vitral', opcoes)
        plugins = [fw === 'vue' ? vue() : react(), vitral(opcoes)]
      } else {
        const singleton = (v) => ({ singleton: true, requiredVersion: `^${v}` })
        const shared = !c.compartilha ? {} : fw === 'vue' ? { vue: singleton(VERSOES.vue) } : { react: singleton(VERSOES.react), 'react-dom': singleton(VERSOES['react-dom']) }
        let opcoes = { name: nome, filename: 'remoteEntry.js', exposes: { './Cartao': `./src/mf-${fw}.${fw === 'vue' ? 'js' : 'jsx'}` }, shared, dts: false, manifest: false }
        if (c.build) opcoes = c.build('mf', opcoes)
        plugins = [fw === 'vue' ? vue() : react(), federation(opcoes)]
      }
      console.log(`build ${c.id}/${nome}`)
      await build({ ...base, plugins, build: { outDir, emptyOutDir: true, target: 'es2022', ...(c.ferramenta === 'mf' && { modulePreload: false }) } })
    }
  }
}

// ---------- servidor: estático, brotli 11, cache de CDN ----------

const tipos = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8' }

function servir() {
  const brotli = new Map()
  const porCenario = Object.fromEntries(lista.map((c) => [c.id, c]))
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const path = normalize(decodeURIComponent(url.pathname))
    let file = join(out, path.endsWith('/') ? path + 'index.html' : path)
    try {
      if (!file.startsWith(out)) throw new Error('404')
      const info = await stat(file)
      if (!info.isFile()) throw new Error('404')
      const etag = `"${info.size}-${info.mtimeMs}"`
      if (req.headers['if-none-match'] === etag) return void res.writeHead(304, { etag }).end()
      const headers = {
        etag,
        'content-type': tipos[extname(file)] ?? 'application/octet-stream',
        'cache-control': /-[\w-]{6,}\.(m?js|css)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
      }
      let body = await readFile(file)
      if (/\bbr\b/.test(req.headers['accept-encoding'] ?? '')) {
        if (!brotli.has(file)) brotli.set(file, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }))
        body = brotli.get(file)
        headers['content-encoding'] = 'br'
      }
      const cenario = porCenario[path.split('/')[1]] ?? porCenario[url.searchParams.get('remotes')]
      const extra = cenario?.servidor?.(req, file)
      if (extra?.body) body = extra.body
      Object.assign(headers, extra?.headers)
      res.writeHead(200, headers).end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((ok) => server.listen(args.servir ? 4301 : 0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })))
}

// ---------- medição ----------

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const r1 = (n) => Math.round(n * 10) / 10

async function visitar(context, url, cenario) {
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', REDE)
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const reqs = new Map()
  let bytes = 0
  let jsBytes = 0
  let rede = 0
  cdp.on('Network.requestWillBeSent', (e) => !e.request.url.startsWith('data:') && reqs.set(e.requestId, { url: e.request.url, cache: false }))
  cdp.on('Network.requestServedFromCache', (e) => reqs.has(e.requestId) && (reqs.get(e.requestId).cache = true))
  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId)
    if (r && (e.response.fromDiskCache || e.response.fromPrefetchCache)) r.cache = true
  })
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId)
    if (!r) return
    if (!r.cache) rede++
    bytes += e.encodedDataLength
    if (/\.m?js(\?|$)/.test(r.url)) jsBytes += e.encodedDataLength
  })
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  // A sonda do SRI do vitral (core/sri.ts) importa de propósito um blob: com hash errado; o Chromium loga a recusa.
  const sonda = (t) => /integrity/.test(t) && /blob:/.test(t)
  page.on('console', (m) => m.type() === 'error' && !sonda(m.text()) && erros.push(m.text()))
  if (cenario.antes) await cenario.antes(page, url)
  await page.goto(url)
  await page.waitForFunction(() => window.__ready || window.__erro, null, { timeout: 120_000 })
  const { ready, erro } = await page.evaluate(() => ({ ready: window.__ready, erro: window.__erro }))
  if (erro || erros.length) throw new Error(`${cenario.id}: ${erro ?? erros.join('; ')}`)
  // Memória: heap JS da página depois de montar, com GC forçado.
  await cdp.send('HeapProfiler.collectGarbage')
  const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize
  return { page, ready, bytes, jsBytes, rede, heap }
}

async function medir(server, browser) {
  const linhas = []
  for (const c of lista) {
    for (const n of NS) {
      const q = new URLSearchParams({ remotes: c.id, n: String(n), ...c.query })
      const url = `${server.url}/host-${c.host}/?${q}`
      // Uma visita fora da conta: o servidor comprime cada arquivo na primeira vez que o serve.
      const aquece = await browser.newContext()
      await (await visitar(aquece, url, c)).page.close()
      await aquece.close()
      const a = { frioMs: [], quenteMs: [], frioKB: [], frioJsKB: [], quenteKB: [], frioRede: [], quenteRede: [], heapMB: [] }
      for (let i = 0; i < RUNS; i++) {
        const context = await browser.newContext()
        const frio = await visitar(context, url, c)
        await frio.page.close()
        const quente = await visitar(context, url, c)
        await context.close()
        a.frioMs.push(frio.ready)
        a.quenteMs.push(quente.ready)
        a.frioKB.push(frio.bytes / 1024)
        a.frioJsKB.push(frio.jsBytes / 1024)
        a.quenteKB.push(quente.bytes / 1024)
        a.frioRede.push(frio.rede)
        a.quenteRede.push(quente.rede)
        a.heapMB.push(frio.heap / 1024 / 1024)
      }
      const linha = { cenario: c.id, rotulo: c.rotulo, n }
      for (const [k, v] of Object.entries(a)) linha[k] = { mediana: r1(mediana(v)), min: r1(Math.min(...v)), max: r1(Math.max(...v)) }
      linha.heapMB = { mediana: Math.round(mediana(a.heapMB) * 100) / 100, min: Math.round(Math.min(...a.heapMB) * 100) / 100, max: Math.round(Math.max(...a.heapMB) * 100) / 100 }
      console.log(`${c.rotulo.padEnd(24)} N=${String(n).padEnd(2)} frio ${linha.frioMs.mediana} ms, quente ${linha.quenteMs.mediana} ms, ${linha.frioKB.mediana} kB, ${linha.frioRede.mediana} req, heap ${linha.heapMB.mediana} MB`)
      linhas.push(linha)
    }
  }
  return linhas
}

// O host sozinho, sem remotes (n=0): JS que a página baixa e requisições.
async function medirHost(server, browser, host) {
  const c = lista.find((x) => x.host === host)
  const context = await browser.newContext()
  const v = await visitar(context, `${server.url}/host-${host}/?remotes=${c.id}&n=0`, c)
  await context.close()
  return { jsKB: r1(v.jsBytes / 1024), requisicoes: v.rede }
}

if (!args['sem-build']) {
  instalar()
  await construir()
}
const server = await servir()
if (args.servir) {
  console.log(`${server.url}/host-vitral/?remotes=vitral-dedupe&n=4`)
  await new Promise(() => {})
}
const browser = await chromium.launch()
const chromiumVersao = browser.version()
let linhas
const hosts = {}
try {
  for (const h of new Set(lista.map((c) => c.host))) hosts[h] = await medirHost(server, browser, h)
  console.log('host sozinho:', JSON.stringify(hosts))
  linhas = await medir(server, browser)
} finally {
  await browser.close()
  server.close()
}

const versao = (p) => JSON.parse(readFileSync(join(work, 'node_modules', p, 'package.json'), 'utf8')).version
let commit = ''
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim()
} catch {}
const resultado = {
  data: new Date().toISOString().slice(0, 10),
  metodo: {
    rede: 'Slow 4G do Lighthouse via CDP Network.emulateNetworkConditions: 150 ms RTT, 1,6 Mbps down, 750 kbps up',
    cpu: CPU > 1 ? `Emulation.setCPUThrottlingRate ${CPU}x` : 'sem throttling de CPU',
    repeticoes: RUNS,
    estatistica: 'mediana, com mínimo e máximo',
    compressao: 'brotli nível 11 no servidor; bytes = encodedDataLength do CDP (corpo + cabeçalhos)',
    pronto: 'performance.now() quando os N .cartao estão no DOM (MutationObserver no host)',
    memoria: 'Runtime.getHeapUsage().usedSize depois de HeapProfiler.collectGarbage, na visita fria',
    remotes: '3 React para cada Vue; cada remote é um build separado com nome próprio',
  },
  versoes: {
    vitral: `${versao('vitral')}${commit && ` (commit ${commit})`}`,
    ...Object.fromEntries(Object.keys(VERSOES).map((p) => [p, versao(p)])),
    chromium: chromiumVersao,
    playwright: JSON.parse(readFileSync(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version,
    node: process.version,
  },
  maquina: { cpu: cpus()[0]?.model, nucleos: cpus().length, memoriaGB: Math.round(totalmem() / 1024 ** 3), so: `${platform()} ${release()}` },
  host: hosts,
  resultados: linhas,
}
writeFileSync(args.out, JSON.stringify(resultado, null, 2) + '\n')
console.log(`\ngravado em ${args.out}\n`)
console.log(tabela(resultado.resultados))

// Tabela em Markdown, no formato da página de docs.
function tabela(linhas) {
  const f = (v) => String(v.mediana).replace('.', ',')
  const cab = '| Cenário | N | Frio (ms) | Quente (ms) | Transferido frio (kB) | JS frio (kB) | Requisições frio | Requisições quente | Heap (MB) |'
  const sep = '| --- | --: | --: | --: | --: | --: | --: | --: | --: |'
  const corpo = linhas.map((l) => `| ${l.rotulo} | ${l.n} | ${f(l.frioMs)} | ${f(l.quenteMs)} | ${f(l.frioKB)} | ${f(l.frioJsKB)} | ${f(l.frioRede)} | ${f(l.quenteRede)} | ${f(l.heapMB)} |`)
  return [cab, sep, ...corpo].join('\n')
}
