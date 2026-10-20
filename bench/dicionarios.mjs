// Mede dicionários de compressão (Compression Dictionary Transport) nos
// bundles reais dos remotes de examples/remotes.
//
//   pnpm build:all
//   node bench/dicionarios.mjs [--antes rótulo=pasta/examples/remotes ...]
//
// Precisa dos binários `brotli` (1.1+) e `zstd` (1.5+) no PATH: o zlib do
// Node não comprime brotli com dicionário nem treina dicionário zstd.
//
// Cenários, por arquivo de entrada de cada remote (manifest.entry e css):
//   br        brotli -q 11, sem dicionário (linha de base)
//   zstd      zstd -19, sem dicionário
//   treinado  zstd -19 com dicionário treinado (zstd --train) nos OUTROS remotes
//   dcb/dcz compartilhado  brotli/zstd com os outros remotes concatenados
//             como dicionário bruto (o que o navegador aceita)
//   dcb/dcz delta  brotli/zstd com a versão anterior do mesmo arquivo como
//             dicionário (o caso de deploy)
//
// Versões anteriores: cada --antes aponta para examples/remotes de outro
// checkout já buildado (ex.: `git worktree add /tmp/v030 vitral@0.3.0`,
// `pnpm install && pnpm build:all` nele). Sem --antes, mede só o "patch":
// o script builda cada remote de novo com uma linha a mais no código do app.
//
// Os tamanhos dcb e dcz já somam o cabeçalho do formato (36 e 40 bytes).
// Grava bench/dicionarios.json.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const remotesDir = join(root, 'examples/remotes')
const DCB = 36
const DCZ = 40

const antes = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--antes') {
    const [rotulo, pasta] = argv[++i].split('=')
    antes.push({ rotulo, pasta })
  }
}

for (const bin of ['brotli', 'zstd']) {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' })
  } catch {
    console.error(`Falta o binário ${bin} no PATH.`)
    process.exit(1)
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'vitral-dict-'))
const br = (file, dict) => execFileSync('brotli', ['-q', '11', '-c', ...(dict ? ['-D', dict] : []), file], { maxBuffer: 1 << 28 }).length
const zs = (file, dict) => execFileSync('zstd', ['-19', '-c', '-q', ...(dict ? ['-D', dict] : []), file], { maxBuffer: 1 << 28 }).length

/** Arquivos que o host baixa de um remote: entrada e CSS do manifesto. */
function arquivos(dist) {
  const m = JSON.parse(readFileSync(join(dist, 'vitral.json'), 'utf8'))
  return [['entry', m.entry], ...(m.css ?? []).map((c, i) => [`css${i}`, c])].map(([papel, f]) => ({ papel, path: join(dist, f) }))
}

function remotes(pasta) {
  const out = {}
  for (const nome of readdirSync(pasta).sort()) {
    const dist = join(pasta, nome, 'dist')
    if (existsSync(join(dist, 'vitral.json'))) out[nome] = arquivos(dist)
  }
  return out
}

/** Builda o remote de novo com uma linha a mais em cada módulo do app (um deploy de patch). */
async function patch(nome) {
  const dir = join(remotesDir, nome)
  const req = createRequire(join(dir, 'package.json'))
  const { build } = await import(pathToFileURL(req.resolve('vite')).href)
  const config = readdirSync(dir).find((f) => /^vite\.config\.[cm]?[jt]s$/.test(f))
  const outDir = join(tmp, 'patch', nome, 'dist')
  await build({
    root: dir,
    configFile: config ? join(dir, config) : false,
    logLevel: 'error',
    build: { outDir, emptyOutDir: true },
    plugins: [
      {
        name: 'bench-patch',
        enforce: 'post',
        transform(code, id) {
          if (id.includes('node_modules') || id.includes('?') || !id.startsWith(join(dir, 'src'))) return
          return `${code}\n;globalThis.__benchPatch = (globalThis.__benchPatch ?? 0) + 1\n`
        },
      },
    ],
  })
  return arquivos(outDir)
}

const atual = remotes(remotesDir)
const nomes = Object.keys(atual)
if (!nomes.length) {
  console.error('Rode `pnpm build:all` antes: nenhum examples/remotes/*/dist/vitral.json.')
  process.exit(1)
}

const env = process.env.NODE_ENV
const patches = {}
for (const nome of nomes) patches[nome] = await patch(nome)
if (env === undefined) delete process.env.NODE_ENV
else process.env.NODE_ENV = env

// Dicionários por remote, sem o próprio remote (leave-one-out).
const dicts = {}
for (const nome of nomes) {
  const outros = nomes.filter((n) => n !== nome).flatMap((n) => atual[n].map((a) => a.path))
  const bruto = join(tmp, `bruto-${nome}`)
  writeFileSync(bruto, Buffer.concat(outros.map((f) => readFileSync(f))))
  const treinado = join(tmp, `treinado-${nome}`)
  execFileSync('zstd', ['--train', '-q', '-B16384', '--maxdict=112640', ...outros, '-o', treinado], { stdio: 'ignore' })
  dicts[nome] = { bruto, treinado, brutoBytes: statSync(bruto).size, brutoBr: br(bruto) }
}

const linhas = []
function medir(nome, papel, path, prev, cenario) {
  const raw = statSync(path).size
  const l = { remote: nome, papel, cenario, raw, br: br(path), zstd: zs(path) }
  l.treinado = zs(path, dicts[nome].treinado)
  l.dcbCompartilhado = br(path, dicts[nome].bruto) + DCB
  l.dczCompartilhado = zs(path, dicts[nome].bruto) + DCZ
  // Arquivo igual ao da versão anterior: mesmo nome com hash, sai do cache do navegador.
  if (prev && readFileSync(prev).equals(readFileSync(path))) l.igual = true
  else if (prev) {
    l.dcbDelta = br(path, prev) + DCB
    l.dczDelta = zs(path, prev) + DCZ
  }
  linhas.push(l)
}

for (const nome of nomes) {
  for (const a of atual[nome]) medir(nome, a.papel, a.path, null, 'atual')
  for (const a of patches[nome]) {
    const prev = atual[nome].find((x) => x.papel === a.papel)
    medir(nome, a.papel, a.path, prev?.path, 'patch')
  }
}
// Releases: cada --antes é a versão anterior da seguinte (ou da atual, a última).
for (let i = 0; i < antes.length; i++) {
  const velho = remotes(antes[i].pasta)
  const novo = i + 1 < antes.length ? remotes(antes[i + 1].pasta) : atual
  const rotuloNovo = i + 1 < antes.length ? antes[i + 1].rotulo : 'atual'
  for (const nome of nomes) {
    for (const a of novo[nome] ?? []) {
      const prev = velho[nome]?.find((x) => x.papel === a.papel)
      if (prev) medir(nome, a.papel, a.path, prev.path, `${antes[i].rotulo}→${rotuloNovo}`)
    }
  }
}

const COLS = ['zstd', 'treinado', 'dcbCompartilhado', 'dczCompartilhado', 'dcbDelta', 'dczDelta']
// Remotes sem framework (só o runtime do vitral e código do app) e remotes com framework.
const SEM_FRAMEWORK = ['intruso', 'loja', 'vanilla']
const grupo = (nome) => (SEM_FRAMEWORK.includes(nome) ? 'sem framework' : 'com framework')

function resumo(ls) {
  const iguais = ls.filter((l) => l.igual).length
  ls = ls.filter((l) => !l.igual)
  const r = { arquivos: ls.length, iguais, raw: sum(ls, 'raw'), br: sum(ls, 'br') }
  for (const c of COLS) {
    const com = ls.filter((l) => l[c] != null)
    if (!com.length) continue
    // Média por arquivo da economia sobre brotli 11, e economia no total de bytes.
    r[c] = {
      media: pct(com.reduce((s, l) => s + (1 - l[c] / l.br), 0) / com.length),
      total: pct(1 - sum(com, c) / sum(com, 'br')),
    }
  }
  return r
}
const sum = (ls, k) => ls.reduce((s, l) => s + l[k], 0)
const pct = (x) => Math.round(x * 1000) / 10

const cenarios = [...new Set(linhas.map((l) => l.cenario))]
const dados = {
  ferramentas: {
    node: process.version,
    brotli: execFileSync('brotli', ['--version']).toString().trim(),
    zstd: execFileSync('zstd', ['--version']).toString().trim(),
  },
  dicionarios: Object.fromEntries(nomes.map((n) => [n, { brutoBytes: dicts[n].brutoBytes, brutoBr: dicts[n].brutoBr }])),
  grupos: { 'sem framework': SEM_FRAMEWORK, 'com framework': nomes.filter((n) => !SEM_FRAMEWORK.includes(n)) },
  resumo: Object.fromEntries(
    cenarios.flatMap((c) => {
      const ls = linhas.filter((l) => l.cenario === c)
      return [
        [c, resumo(ls)],
        ...['com framework', 'sem framework'].map((g) => [`${c} (${g})`, resumo(ls.filter((l) => grupo(l.remote) === g))]),
      ]
    }),
  ),
  linhas,
}
writeFileSync(join(root, 'bench/dicionarios.json'), `${JSON.stringify(dados, null, 2)}\n`)
rmSync(tmp, { recursive: true, force: true })

console.log('Economia sobre brotli 11 (média por arquivo / no total de bytes), em %')
console.log(['cenário', 'arquivos', 'iguais', ...COLS].join('\t'))
for (const [c, r] of Object.entries(dados.resumo)) {
  console.log([c, r.arquivos, r.iguais, ...COLS.map((k) => (r[k] ? `${r[k].media} / ${r[k].total}` : '-'))].join('\t'))
}
