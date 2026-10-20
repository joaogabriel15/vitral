// Benchmark público: vitral contra o Next.js Multi-Zones, num app dividido
// por rota entre duas equipes (A e B). No Multi-Zones, cada equipe é um app
// Next (uma zona) e a troca de zona recarrega a página. No vitral, um app
// shell monta o remote de cada rota e troca sem recarregar.
//
//   pnpm build && node bench/publico/zonas.mjs [--runs 7] [--only id,id] [--cpu 4]
//                                              [--work <pasta>] [--out <arquivo.json>] [--sem-build] [--servir]
//
// Mede, para cada cenário, com a rede "Slow 4G" do run.mjs:
// - frio: abrir A com cache vazio até A interativo (e a primeira pintura);
// - troca: de clicar em A até B interativo, com o cache que a visita em A deixou;
// - com prefetch: o mesmo, depois de o prefetch de B terminar em A.
//
// Não roda no CI e não muda bench/baseline.json.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { X509Certificate, createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createSecureServer } from 'node:http2'
import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, platform, release, totalmem } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { brotliCompressSync, constants } from 'node:zlib'
import { chromium } from 'playwright'

// Versões medidas. Mudou uma, rode de novo e atualize a página de docs.
const VERSOES = {
  next: '16.4.2',
  vite: '8.3.4',
  '@vitejs/plugin-react': '6.1.2',
  react: '19.3.0',
  'react-dom': '19.3.0',
}

const REDE = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }

// Regras de especulação do Chromium para a outra zona, como o componente
// SpeculationRules do curso de microfrontends da Vercel. Aqui com
// eagerness "immediate", para o prefetch terminar antes do clique, como no
// vitral. Só prefetch: com o DevTools ligado (Playwright, CDP), o Chromium
// desliga o prerender (status PrerenderingDisabledByDevTools).
const regras = (acao) =>
  `<script type="speculationrules">${JSON.stringify({ [acao]: [{ source: 'list', urls: ['/b/'], eagerness: 'immediate' }] })}</script>`

/** @type {{ id: string, rotulo: string, tipo: 'vitral' | 'zonas', dedupe?: boolean, gateway?: boolean, prefetch?: 'vitral' | 'prefetch' }[]} */
const cenarios = [
  { id: 'vitral', rotulo: 'vitral, sem dedupe', tipo: 'vitral', dedupe: false },
  { id: 'vitral-dedupe', rotulo: 'vitral, com dedupe', tipo: 'vitral', dedupe: true },
  { id: 'vitral-prefetch', rotulo: 'vitral, dedupe e prefetch', tipo: 'vitral', dedupe: true, prefetch: 'vitral' },
  // O gateway de vitral/edge com `routes`: SSR do remote da rota e hints na primeira visita.
  { id: 'vitral-gateway', rotulo: 'vitral, gateway com SSR', tipo: 'vitral', dedupe: true, gateway: true },
  { id: 'vitral-gateway-prefetch', rotulo: 'vitral, gateway e prefetch', tipo: 'vitral', dedupe: true, gateway: true, prefetch: 'vitral' },
  { id: 'zonas', rotulo: 'Multi-Zones', tipo: 'zonas' },
  { id: 'zonas-prefetch', rotulo: 'Multi-Zones, prefetch', tipo: 'zonas', prefetch: 'prefetch' },
]

const here = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(here, '../..')
const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '7' },
    only: { type: 'string' },
    work: { type: 'string', default: join(here, '../node_modules/.cache/zonas') },
    out: { type: 'string', default: join(here, 'resultado-zonas.json') },
    cpu: { type: 'string', default: '1' },
    'sem-build': { type: 'boolean', default: false },
    servir: { type: 'boolean', default: false },
  },
})
const RUNS = Number(args.runs)
const CPU = Number(args.cpu)
const lista = args.only ? cenarios.filter((c) => args.only.split(',').includes(c.id)) : cenarios
const work = resolve(args.work)
const out = join(work, 'out')
const fontes = join(here, 'fontes')

// ---------- preparo: instala e constrói ----------

const vitralDir = join(root, 'packages/vitral')
if (!existsSync(join(vitralDir, 'dist/index.js'))) {
  console.error('Rode `pnpm build` antes: falta packages/vitral/dist/index.js')
  process.exit(1)
}

function instalar() {
  mkdirSync(work, { recursive: true })
  rmSync(join(work, 'pacote'), { recursive: true, force: true })
  execFileSync('pnpm', ['pack', '--pack-destination', join(work, 'pacote')], { cwd: vitralDir, stdio: 'ignore' })
  const tgz = join(work, 'pacote', readdirSync(join(work, 'pacote'))[0])
  const pkg = { name: 'bench-zonas-work', private: true, type: 'module', dependencies: { ...VERSOES, vitral: `file:${tgz}` } }
  const atual = existsSync(join(work, 'package.json')) && readFileSync(join(work, 'package.json'), 'utf8')
  writeFileSync(join(work, 'package.json'), JSON.stringify(pkg, null, 2))
  const npm = ['install', '--no-audit', '--no-fund', '--no-package-lock']
  if (atual !== JSON.stringify(pkg, null, 2) || !existsSync(join(work, 'node_modules'))) execFileSync('npm', npm, { cwd: work, stdio: 'inherit' })
  else {
    // Mesma versão no tarball novo: o npm reaproveita a cópia do cache dele.
    // Extrai o tarball direto (as dependências do vitral já estão instaladas).
    const dir = join(work, 'node_modules/vitral')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir)
    execFileSync('tar', ['xzf', tgz, '-C', dir, '--strip-components=1'])
  }
}

async function construir() {
  rmSync(out, { recursive: true, force: true })
  const tipos = new Set(lista.map((c) => c.tipo))

  if (tipos.has('zonas')) {
    // Duas zonas, cada uma um app Next com o próprio basePath (e, com ele, o
    // próprio /<zona>/_next/ para os assets). Export estático: o HTML sai
    // pronto do build, o melhor caso do Next para a primeira pintura.
    for (const [zona, outra] of [['a', 'b'], ['b', 'a']]) {
      const dir = join(work, `zona-${zona}`)
      rmSync(dir, { recursive: true, force: true })
      cpSync(join(fontes, 'zonas/next'), dir, { recursive: true })
      writeFileSync(join(dir, 'app/Cartao.jsx'), `'use client'\n${readFileSync(join(fontes, 'Cartao.jsx'), 'utf8')}`)
      writeFileSync(
        join(dir, 'next.config.mjs'),
        `export default ${JSON.stringify({ output: 'export', basePath: `/${zona}`, trailingSlash: true, env: { ZONA: zona, OUTRA: outra }, turbopack: { root: work } })}\n`,
      )
      console.log(`build zona-${zona}`)
      execFileSync(join(work, 'node_modules/.bin/next'), ['build'], { cwd: dir, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } })
      cpSync(join(dir, 'out'), join(out, zona), { recursive: true })
    }
  }

  if (tipos.has('vitral')) {
    writeFileSync(
      join(work, 'ferramentas.mjs'),
      `export { build } from 'vite'\nexport { default as react } from '@vitejs/plugin-react'\nexport { default as vitral } from 'vitral/vite'\n`,
    )
    const { build, react, vitral } = await import(pathToFileURL(join(work, 'ferramentas.mjs')).href)
    const base = { configFile: false, logLevel: 'warn' }
    rmSync(join(work, 'src'), { recursive: true, force: true })
    cpSync(fontes, join(work, 'src'), { recursive: true })
    await build({ ...base, root: join(work, 'src/zonas/vitral'), base: '/v/', build: { outDir: join(out, 'v'), emptyOutDir: true, target: 'es2022' } })
    for (const dedupe of new Set(lista.filter((c) => c.tipo === 'vitral').map((c) => c.dedupe))) {
      for (const nome of ['a', 'b']) {
        console.log(`build vitral${dedupe ? '-dedupe' : ''}/${nome}`)
        const opcoes = { entry: 'src/Cartao.jsx', name: nome, ...(dedupe && { dedupe: ['react'] }) }
        await build({ ...base, root: work, base: './', plugins: [react(), vitral(opcoes)], build: { outDir: join(out, `vitral${dedupe ? '-dedupe' : ''}`, nome), emptyOutDir: true, target: 'es2022' } })
      }
    }
    // `render` do remote para o gateway (roda no Node, fora de `out/`).
    if (lista.some((c) => c.gateway)) {
      await build({ ...base, root: work, plugins: [react()], build: { ssr: 'src/zonas/vitral/servidor.jsx', outDir: join(work, 'servidor'), emptyOutDir: true, target: 'node20' } })
    }
  }
}

// ---------- servidor: estático, brotli 11, cache de CDN ----------

// Bytes (corpo, como foi pela rede) e respostas que o navegador recebeu,
// contados nos servidores que ele acessa. O CDP não dá o tamanho dos arquivos
// que chegam por 103 Early Hints; aqui todos contam igual. Cache do navegador
// não chega ao servidor; 304 conta como resposta.
const contar = { bytes: 0, rede: 0 }
const enviado = (req, body) => {
  if (req.httpVersion !== '2.0') return
  contar.rede++
  contar.bytes += body?.length ?? 0
}
// /a/* e /b/* são as zonas (como as rewrites do Multi-Zones, mas sem o salto
// por um terceiro app); /v/* é o app shell do vitral, com fallback de SPA.

const tipos = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain' }

// HTTP/2 com TLS, como um CDN: sem o limite de 6 conexões do HTTP/1.1, que
// pesaria mais para quem tem mais arquivos. O certificado é gerado na pasta de
// trabalho e o Chromium confia nele pela chave (--ignore-certificate-errors-spki-list),
// então o cache HTTP funciona como num certificado válido.
function certificado() {
  const key = join(work, 'tls.key')
  const cert = join(work, 'tls.crt')
  if (!existsSync(cert)) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '3650', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert], { stdio: 'ignore' })
  }
  const tls = { key: readFileSync(key), cert: readFileSync(cert) }
  const spki = new X509Certificate(tls.cert).publicKey.export({ type: 'spki', format: 'der' })
  return { tls, spki: createHash('sha256').update(spki).digest('base64') }
}

/** Sobe `handler` em HTTP/2 (para o navegador) e, com `interno`, também em HTTP/1.1 sem TLS (para o gateway buscar). */
function ouvir(handler, porta, interno) {
  const { tls } = certificado()
  const h2 = createSecureServer({ ...tls, allowHTTP1: true }, handler)
  const h1 = interno ? createServer(handler) : null
  const listen = (s, p) => new Promise((ok) => s.listen(p, '127.0.0.1', () => ok(s.address().port)))
  return Promise.all([listen(h2, porta), h1 && listen(h1, 0)]).then(([p2, p1]) => ({
    url: `https://127.0.0.1:${p2}`,
    interno: p1 && `http://127.0.0.1:${p1}`,
    close: () => (h2.close(), h1?.close()),
  }))
}

function servir() {
  const cache = new Map()
  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/favicon.ico') return void res.writeHead(204).end()
    const path = normalize(decodeURIComponent(url.pathname))
    let file = join(out, path.endsWith('/') ? path + 'index.html' : path)
    try {
      if (!file.startsWith(out)) throw new Error('404')
      if (/^\/[vg]\//.test(path) && !existsSync(file)) file = join(out, 'v/index.html')
      const info = await stat(file)
      if (!info.isFile()) throw new Error('404')
      // Prefetch do Multi-Zones: a página A leva as regras de especulação.
      const spec = url.searchParams.get('spec')
      const etag = `"${info.size}-${info.mtimeMs}${spec ? `-${spec}` : ''}"`
      if (req.headers['if-none-match'] === etag) return void (enviado(req), res.writeHead(304, { etag }).end())
      const headers = {
        etag,
        'content-type': tipos[extname(file)] ?? 'application/octet-stream',
        // Next: /_next/static/ tem hash no nome. vitral: -<hash>.js.
        'cache-control': /\/_next\/static\/|-[\w-]{6,}\.(m?js|css)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
      }
      const chave = `${file}|${spec ?? ''}`
      if (!cache.has(chave)) {
        let body = await readFile(file)
        if (spec && file.endsWith('.html')) body = Buffer.from(body.toString().replace('</head>', `${regras(spec)}</head>`))
        cache.set(chave, { raw: body, br: brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) })
      }
      let body = cache.get(chave).raw
      if (/\bbr\b/.test(req.headers['accept-encoding'] ?? '')) {
        body = cache.get(chave).br
        headers['content-encoding'] = 'br'
      }
      enviado(req, body)
      res.writeHead(200, headers).end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  }
  return ouvir(handler, args.servir ? 4302 : 0, true)
}

// Gateway de vitral/edge na frente do servidor estático, como num edge: o
// HTML e os remotes saem da mesma origem, com brotli 11 na saída.
async function servirGateway(origem) {
  const { gateway } = await import(pathToFileURL(join(work, 'node_modules/vitral/dist/edge.js')).href)
  const { render } = await import(pathToFileURL(join(work, 'servidor/servidor.js')).href)
  const remote = (nome) => ({ url: `${origem.interno}/vitral-dedupe/${nome}/vitral.json`, render })
  const gw = gateway({ origin: origem.interno, remotes: { a: remote('a'), b: remote('b') }, routes: { '/g/a': 'a', '/g/b': 'b' } })
  const comprimidos = new Map()
  const handler = async (req, res) => {
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined && !k.startsWith(':')) headers.set(k, String(v))
    // O gateway pede ao servidor estático sem brotli (o fetch do Node decodificaria) e comprime na saída.
    headers.delete('accept-encoding')
    const request = new Request(`https://${req.headers[':authority'] ?? req.headers.host}${req.url}`, { headers })
    // 103 Early Hints com os arquivos do remote da rota, antes de buscar a página.
    const link = await gw.hints(request)
    if (link.length) res.writeEarlyHints({ link })
    const response = await gw(request)
    const out = {}
    response.headers.forEach((v, k) => (out[k] = v))
    let body = Buffer.from(await response.arrayBuffer())
    if (/\bbr\b/.test(req.headers['accept-encoding'] ?? '') && body.length) {
      // As respostas não mudam durante a medição: comprime uma vez por URL (na visita de aquecimento).
      if (comprimidos.get(req.url)?.raw.equals(body) !== true) comprimidos.set(req.url, { raw: body, br: brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) })
      body = comprimidos.get(req.url).br
      out['content-encoding'] = 'br'
    }
    enviado(req, body)
    res.writeHead(response.status, out).end(body)
  }
  return ouvir(handler, args.servir ? 4303 : 0, false)
}

// ---------- medição ----------

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const r1 = (n) => Math.round(n * 10) / 10

// Rede e CPU limitadas na página, pelo CDP.
async function limitar(context, page) {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', REDE)
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
}

async function abrir(context) {
  const page = await context.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  const sonda = (t) => /integrity|import ?map/i.test(t) && /blob:|data:/.test(t)
  page.on('console', (m) => m.type() === 'error' && !sonda(m.text()) && erros.push(m.text()))
  return { page, erros }
}

const urlA = (server, c) =>
  c.gateway
    ? `${server.gateway.url}/g/a${c.prefetch ? '?prefetch' : ''}`
    : c.tipo === 'vitral'
    ? `${server.url}/v/a?remotes=${c.dedupe ? 'vitral-dedupe' : 'vitral'}${c.prefetch ? '&prefetch' : ''}`
    : `${server.url}/a/${c.prefetch ? `?spec=${c.prefetch}` : ''}`

async function pronto(page) {
  await page.waitForFunction(() => window.__ready, null, { timeout: 120_000 })
  // A primeira pintura pode entrar na linha do tempo depois do fim.
  return page.evaluate(
    () =>
      new Promise((ok) => {
        const fim = (fcp) => ok({ ready: window.__ready, fcp })
        new PerformanceObserver((l, o) => {
          const e = l.getEntriesByName('first-contentful-paint')[0]
          if (e) o.disconnect(), fim(e.startTime)
        }).observe({ type: 'paint', buffered: true })
        setTimeout(() => fim(null), 3000)
      }),
  )
}

// O prefetch do vitral aprende as rotas: treina A → B 3 vezes, como o run.mjs.
async function treinar(browser, server, c) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(urlA(server, c))
  await page.waitForFunction(() => window.__ready, null, { timeout: 120_000 })
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__go('/v/b'))
    await page.evaluate(() => window.__go('/v/a'))
  }
  const estado = await context.storageState()
  await context.close()
  return estado
}

async function visita(browser, server, c) {
  const storageState = c.prefetch === 'vitral' ? await treinar(browser, server, c) : undefined
  const context = await browser.newContext({ storageState })
  const { page, erros } = await abrir(context)
  await limitar(context, page)
  contar.bytes = contar.rede = 0
  await page.goto(urlA(server, c))
  const a = await pronto(page)
  const frio = { ms: a.ready, fcp: a.fcp, kB: contar.bytes / 1024, rede: contar.rede }
  if (c.prefetch === 'vitral') await page.waitForFunction(() => window.__prefetched.includes('b'), null, { timeout: 60_000 })
  // Tempo de leitura da página A, o mesmo em todos. Com as regras de
  // especulação, dá tempo de o prefetch ou o prerender de B terminar.
  await page.waitForTimeout(c.prefetch && c.tipo === 'zonas' ? 5000 : 500)
  const antes = { bytes: contar.bytes, rede: contar.rede }
  let ms
  if (c.tipo === 'vitral') {
    ms = await page.evaluate(() => window.__go('/v/b'))
  } else {
    const t0 = await page.evaluate(() => performance.timeOrigin + performance.now())
    await page.click('#ir')
    await page.waitForURL('**/b/')
    await page.waitForFunction(() => window.__ready, null, { timeout: 120_000 })
    ms = await page.evaluate((t0) => performance.timeOrigin + window.__ready - t0, t0)
  }
  const troca = { ms, kB: (contar.bytes - antes.bytes) / 1024, rede: contar.rede - antes.rede, totalKB: contar.bytes / 1024 }
  if (erros.length) throw new Error(`${c.id}: ${erros.join('; ')}`)
  await context.close()
  return { frio, troca }
}

async function medir(server, browser) {
  const linhas = []
  for (const c of lista) {
    await visita(browser, server, c) // aquecimento: o servidor comprime na primeira vez
    const v = []
    for (let i = 0; i < RUNS; i++) v.push(await visita(browser, server, c))
    const m = (f) => {
      const xs = v.map(f).filter((x) => x != null)
      return { mediana: r1(mediana(xs)), min: r1(Math.min(...xs)), max: r1(Math.max(...xs)) }
    }
    const linha = {
      cenario: c.id,
      rotulo: c.rotulo,
      frioMs: m((x) => x.frio.ms),
      frioFcpMs: m((x) => x.frio.fcp),
      frioKB: m((x) => x.frio.kB),
      frioRede: m((x) => x.frio.rede),
      trocaMs: m((x) => x.troca.ms),
      trocaKB: m((x) => x.troca.kB),
      trocaRede: m((x) => x.troca.rede),
      totalKB: m((x) => x.troca.totalKB),
    }
    console.log(
      `${c.rotulo.padEnd(28)} frio ${linha.frioMs.mediana} ms (pintura ${linha.frioFcpMs.mediana}), ${linha.frioKB.mediana} kB | troca ${linha.trocaMs.mediana} ms, ${linha.trocaKB.mediana} kB, ${linha.trocaRede.mediana} req | total ${linha.totalKB.mediana} kB`,
    )
    linhas.push(linha)
  }
  return linhas
}

if (!args['sem-build']) {
  instalar()
  await construir()
}
const server = await servir()
if (lista.some((c) => c.gateway)) server.gateway = await servirGateway(server)
if (args.servir) {
  console.log(`${server.url}/v/a?remotes=vitral-dedupe  ${server.url}/a/  ${server.gateway?.url}/g/a`)
  await new Promise(() => {})
}
const browser = await chromium.launch({ channel: 'chromium', args: [`--ignore-certificate-errors-spki-list=${certificado().spki}`] })
const chromiumVersao = browser.version()
let linhas
try {
  linhas = await medir(server, browser)
} finally {
  await browser.close()
  server.close()
  server.gateway?.close()
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
    protocolo: 'HTTP/2 com TLS (certificado local aceito pela chave), brotli 11',
    cpu: CPU > 1 ? `Emulation.setCPUThrottlingRate ${CPU}x` : 'sem throttling de CPU',
    repeticoes: RUNS,
    estatistica: 'mediana, com mínimo e máximo',
    pronto: 'vitral: evento vitral-ready do remote da rota. Next: useEffect depois da hidratação',
    troca: 'de clicar em A até B pronto, no mesmo contexto (cache da visita em A)',
  },
  versoes: {
    vitral: `${versao('vitral')}${commit && ` (commit ${commit})`}`,
    ...Object.fromEntries(Object.keys(VERSOES).map((p) => [p, versao(p)])),
    chromium: chromiumVersao,
    playwright: JSON.parse(readFileSync(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version,
    node: process.version,
  },
  maquina: { cpu: cpus()[0]?.model, nucleos: cpus().length, memoriaGB: Math.round(totalmem() / 1024 ** 3), so: `${platform()} ${release()}` },
  resultados: linhas,
}
writeFileSync(args.out, JSON.stringify(resultado, null, 2) + '\n')
console.log(`\ngravado em ${args.out}\n`)
const f = (v) => String(v.mediana).replace('.', ',')
console.log('| Cenário | Frio, interativo (ms) | Frio, 1ª pintura (ms) | Frio (kB) | Troca A → B (ms) | Troca (kB) | Troca (req.) | Total A + B (kB) |')
console.log('| --- | --: | --: | --: | --: | --: | --: | --: |')
for (const l of linhas) console.log(`| ${l.rotulo} | ${f(l.frioMs)} | ${f(l.frioFcpMs)} | ${f(l.frioKB)} | ${f(l.trocaMs)} | ${f(l.trocaKB)} | ${f(l.trocaRede)} | ${f(l.totalKB)} |`)
