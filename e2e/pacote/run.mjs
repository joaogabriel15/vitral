// Bateria de pacote real (semanal e antes de cada release, .github/workflows/pacote.yml).
//
//   node e2e/pacote/run.mjs [--dir /tmp/vitral-pacote] [--so react,next] [--out pacote.json]
//
// 1. `pnpm pack` do packages/vitral (rode `pnpm build` antes).
// 2. Gera cada app com a CLI oficial (apps.mjs): 7 remotes do create-vite e
//    hosts de create-vite, create-next-app, nuxi init, ng new, sv create,
//    create-astro e create-react-router. Se a CLI falhar, usa modelos/<nome>.
// 3. Instala o tarball com npm, faz o build de produção de cada app.
// 4. Sobe os remotes e cada host em modo produção e confere no Chromium que os
//    7 remotes aparecem e respondem (o contador de cada template sobe).
import { chromium } from '@playwright/test'
import { execSync, spawn } from 'node:child_process'
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { HOSTS, PORTA_REMOTES, REMOTES } from './apps.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = join(here, '../..')
const { values: args } = parseArgs({
  options: {
    dir: { type: 'string', default: join(tmpdir(), 'vitral-pacote') },
    so: { type: 'string' },
    out: { type: 'string' },
    // Reaproveita os apps já gerados e buildados em --dir (para depurar o passo 4).
    reusar: { type: 'boolean', default: false },
  },
})
const DIR = args.dir
const ENV = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', NUXT_TELEMETRY_DISABLED: '1', ASTRO_TELEMETRY_DISABLED: '1', NG_CLI_ANALYTICS: 'false' }
const so = args.so?.split(',')
const escolhido = (app) => !so || so.includes(app.nome)
// Pasta e nome do pacote de cada app: "host-nuxt", "remote-vue". Um app chamado
// "nuxt" que depende de nuxt quebra o npm.
const pasta = (app) => `${app.tipo ?? 'host'}-${app.nome}`

mkdirSync(DIR, { recursive: true })
const log = (msg) => console.error(`[pacote] ${msg}`)

/** Roda um comando; a saída vai para <app>.log. */
function sh(cmd, cwd, arquivoLog) {
  const out = createWriteStream(arquivoLog, { flags: 'a' })
  out.write(`\n$ ${cmd}\n`)
  try {
    const saida = execSync(cmd, { cwd, env: ENV, stdio: 'pipe', timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024 })
    out.end(saida)
  } catch (e) {
    out.end(`${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    throw new Error(`falhou: ${cmd} (veja ${arquivoLog})`)
  }
}

// 1. Pacote
const pacotes = join(DIR, 'pacote')
rmSync(pacotes, { recursive: true, force: true })
mkdirSync(pacotes)
execSync(`pnpm pack --pack-destination ${pacotes}`, { cwd: join(repo, 'packages/vitral'), stdio: 'pipe' })
const tarball = join(pacotes, readdirSync(pacotes).find((f) => f.endsWith('.tgz')))
log(`pacote: ${tarball}`)

// 2 e 3. Apps
const resultados = []
for (const app of [...REMOTES, ...HOSTS].filter(escolhido)) {
  const dir = join(DIR, pasta(app))
  const arquivoLog = join(DIR, `${pasta(app)}.log`)
  if (!args.reusar) {
    rmSync(dir, { recursive: true, force: true })
    rmSync(arquivoLog, { force: true })
  }
  const r = { nome: app.nome, tipo: app.tipo ?? 'host', cli: app.cli ?? 'create-vite', origem: 'CLI', falha: null }
  resultados.push(r)
  if (args.reusar && existsSync(join(dir, 'node_modules'))) {
    r.origem = 'reaproveitado'
    continue
  }
  const t0 = Date.now()
  try {
    try {
      sh(app.criar.replace('{nome}', pasta(app)), DIR, arquivoLog)
      if (!existsSync(join(dir, 'package.json'))) throw new Error('a CLI não gerou package.json')
    } catch (e) {
      const modelo = join(here, 'modelos', pasta(app))
      if (!existsSync(modelo)) throw e
      log(`${app.nome}: a CLI falhou (${e.message}); usando modelos/${pasta(app)}`)
      rmSync(dir, { recursive: true, force: true })
      cpSync(modelo, dir, { recursive: true })
      r.origem = 'modelo versionado'
    }
    app.preparar(dir)
    // Em dois passos: `npm install <tarball>` num projeto sem lockfile quebra no npm 10 (edgesOut).
    sh('npm install --no-audit --no-fund', dir, arquivoLog)
    sh(`npm install --no-audit --no-fund ${tarball}`, dir, arquivoLog)
    sh(app.build, dir, arquivoLog)
    log(`${app.nome}: build ok (${r.origem}, ${Math.round((Date.now() - t0) / 1000)}s)`)
  } catch (e) {
    r.falha = e.message
    log(`${app.nome}: ${e.message}`)
  }
}

// 4. Navegador
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }
function estatico(porta, raiz, spa) {
  return createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\.\.+/g, '')
    let file = raiz(path)
    if (!file || !existsSync(file) || statSync(file).isDirectory()) file = spa ?? null
    if (!file || !existsSync(file)) return void res.writeHead(404, { 'access-control-allow-origin': '*' }).end('not found')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' })
    res.end(readFileSync(file))
  }).listen(porta)
}

const servidores = [
  estatico(PORTA_REMOTES, (p) => {
    const [, nome, ...resto] = p.split('/')
    return nome ? join(DIR, `remote-${nome}`, 'dist', ...resto) : null
  }),
]
const processos = []
async function esperar(url, ms = 120_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      if ((await fetch(url)).status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${url} não respondeu`)
}

const browser = await chromium.launch()
const remotesOk = REMOTES.filter((r) => resultados.find((x) => x.nome === r.nome && !x.falha))
let porta = 4610
try {
  for (const host of HOSTS.filter(escolhido)) {
    const r = resultados.find((x) => x.nome === host.nome)
    if (r.falha) continue
    const url = `http://localhost:${++porta}`
    const dir = join(DIR, pasta(host))
    try {
      if (host.estatico) {
        const raiz = join(dir, host.estatico.replace('{nome}', pasta(host)))
        servidores.push(estatico(porta, (p) => join(raiz, p), join(raiz, 'index.html')))
      } else {
        const proc = spawn(host.iniciar(porta), { cwd: dir, env: ENV, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
        const out = createWriteStream(join(DIR, `${pasta(host)}.log`), { flags: 'a' })
        proc.stdout.pipe(out)
        proc.stderr.pipe(out)
        processos.push(proc)
      }
      await esperar(url)
      const page = await browser.newPage()
      const erros = []
      page.on('pageerror', (e) => erros.push(e.message))
      // Ícones dos templates não são do vitral: 404 de /icons.svg e /favicon.svg na origem do host,
      // e o sprite do create-vite (<use href="/icons.svg#...">), que o navegador bloqueia
      // quando o remote está em outra origem ("Unsafe attempt to load URL .../icons.svg").
      const doTemplate = (t) => t.startsWith('Failed to load resource') || /^Unsafe attempt to load URL \S+\/icons\.svg /.test(t)
      // A sonda do SRI (core/sri.ts) importa de propósito um blob: com hash errado, uma vez
      // por navegador, para ver se o import map confere hashes; o navegador registra a recusa.
      // Mais de uma linha por página é erro.
      const sonda = (t) => /integrity/.test(t) && /blob:/.test(t)
      let sondas = 0
      page.on('console', (m) => {
        if (m.type() !== 'error' || doTemplate(m.text())) return
        if (sonda(m.text()) && ++sondas === 1) return
        erros.push(`console: ${m.text()}`)
      })
      await page.goto(url)
      // Confere todos os remotes, mesmo depois de uma falha, para o relatório dizer quais quebram.
      const quebrados = []
      for (const remote of remotesOk) {
        const contador = page.locator(`section[data-remote="${remote.nome}"] .counter`)
        try {
          await contador.waitFor({ timeout: 30_000 })
          await contador.click()
          await page.waitForFunction(
            ([nome]) => {
              const s = document.querySelector(`section[data-remote="${nome}"]`)
              const achar = (raiz) => raiz.querySelector('.counter') ?? [...raiz.querySelectorAll('*')].map((e) => e.shadowRoot && achar(e.shadowRoot)).find(Boolean)
              return /\b1\b/.test(achar(s)?.textContent ?? '')
            },
            [remote.nome],
            { timeout: 10_000 },
          )
        } catch {
          quebrados.push(remote.nome)
        }
      }
      await page.close()
      const detalhe = erros.length ? ` (${[...new Set(erros.map((e) => e.split('\n')[0]))].join('; ')})` : ''
      if (quebrados.length) throw new Error(`remotes que não funcionaram: ${quebrados.join(', ')}${detalhe}`)
      if (erros.length) throw new Error(`erros na página${detalhe}`)
      r.remotes = remotesOk.length
      log(`${host.nome}: ${remotesOk.length} remotes ok em ${url}`)
    } catch (e) {
      r.falha = e.message
      log(`${host.nome}: ${e.message}`)
    }
  }
} finally {
  await browser.close()
  for (const s of servidores) s.close()
  for (const p of processos) {
    try {
      process.kill(-p.pid)
    } catch {}
  }
}

const linhas = resultados.map((r) => `| ${r.nome} | ${r.tipo} | ${r.cli} | ${r.origem} | ${r.falha ? `falhou: ${r.falha}` : 'ok'} |`)
console.log(`## Pacote real (${tarball.split('/').pop()})

| App | Tipo | CLI | Origem | Resultado |
| --- | --- | --- | --- | --- |
${linhas.join('\n')}
`)
if (args.out) writeFileSync(args.out, JSON.stringify(resultados, null, 2) + '\n')
if (resultados.some((r) => r.falha)) process.exit(1)
