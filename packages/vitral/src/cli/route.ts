/**
 * `vitral doctor --stats stats.json --route /pagina`: o que o host carrega
 * numa rota (o `_app`, o código comum do Next e a página), a partir dos stats
 * do webpack (`stats.toJson()`, o `--json` do webpack ou o `stats.json` do
 * webpack-bundle-analyzer com `generateStatsFile`).
 *
 * Soma os bytes por pacote e aponta o que costuma pesar sem servir à rota:
 * traduções carregadas de uma vez, módulos sem nenhum export usado (que só
 * ficam por efeito colateral), barrels inteiros puxados pelas ofertas do
 * vitral e, com `--remote`, pacotes que o host e o remote levam cada um a sua
 * cópia (candidatos a `share`/`dedupe`). Análise estática, sem rodar o app.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { RemoteManifest } from '../core/types'
import type { Check } from './doctor'

interface StatsModule {
  name?: string
  identifier?: string
  size?: number
  chunks?: (string | number)[]
  usedExports?: boolean | string[] | null
  providedExports?: string[] | null
  reasons?: { moduleName?: string | null }[]
  modules?: StatsModule[]
}
type Group = { chunks?: (string | number)[]; assets?: (string | { name: string; size?: number })[] }
interface Stats {
  entrypoints?: Record<string, Group>
  namedChunkGroups?: Record<string, Group>
  chunks?: { id: string | number; size?: number; files?: string[]; modules?: StatsModule[] }[]
  assets?: { name: string; size?: number }[]
  modules?: StatsModule[]
  children?: Stats[]
}

export interface RouteReport {
  route: string
  /** Grupos de chunks (entrypoints) que a rota carrega. */
  entries: string[]
  /** Bytes do código-fonte dos módulos (antes de minificar e comprimir). */
  bytes: number
  packages: { name: string; bytes: number }[]
  modules: { name: string; bytes: number }[]
  checks: Check[]
}

/** Entrypoints do Next que toda página carrega antes do código dela. */
const SHELL = ['main', 'main-app', 'pages/_app', 'webpack', 'react-refresh']
/** Arquivos de tradução: JSON numa pasta locales, i18n, lang... */
const LOCALE = /(^|[/\\])(locales?|i18n|lang|langs|translations?|messages)[/\\](.*[/\\])?[^/\\]*\.json$/i
const KB = (n: number) => `${Math.round(n / 1024)} kB`

const pkgOf = (name: string): string | undefined => {
  const m = /node_modules[/\\]((?:@[^/\\]+[/\\])?[^/\\]+)/.exec(name.split('!').pop()!.replace(/.*node_modules[/\\]\.pnpm[/\\][^/\\]+[/\\]node_modules/, 'node_modules'))
  return m?.[1].replace(/\\/g, '/')
}

/** Módulos folha (os concatenados contam pelos de dentro). */
function leaves(list: StatsModule[] = []): StatsModule[] {
  return list.flatMap((m) => (m.modules?.length ? leaves(m.modules) : [m]))
}

/** Os stats do cliente: num build multi-compilador, o filho com os entrypoints de páginas. */
function client(s: Stats): Stats {
  if (s.entrypoints && Object.keys(s.entrypoints).some((k) => k.startsWith('pages/') || k === 'main')) return s
  return s.children?.map(client).find((c) => c.entrypoints) ?? s
}

/** O entrypoint da rota: `pages/x/[[...slug]]`, aceitando `/x/[[...slug]]`, `x` ou o nome exato. */
export function routeEntry(names: string[], route: string): string | undefined {
  const r = route.replace(/^\/+/, '').replace(/\/+$/, '') || 'index'
  return names.find((n) => n === route) ?? names.find((n) => n === `pages/${r}`) ?? names.find((n) => n === `pages/${r}/index`) ?? names.find((n) => n.startsWith(`pages/${r}/`) && /\[/.test(n))
}

export interface RouteOptions {
  stats: string
  route: string
  /** `dist` do remote (com `vitral.json` e, se houver, `sbom.cdx.json`) ou o próprio `vitral.json`. */
  remotes?: string[]
  cwd?: string
  /** Quantos pacotes e módulos listar. Padrão 15. */
  top?: number
}

export function routeReport(o: RouteOptions): RouteReport {
  const cwd = o.cwd ?? process.cwd()
  const raw = JSON.parse(readFileSync(resolve(cwd, o.stats), 'utf8')) as Stats
  const s = client(raw)
  const groups = { ...s.namedChunkGroups, ...s.entrypoints }
  const names = Object.keys(groups)
  const page = routeEntry(names, o.route)
  if (!page) throw new Error(`[vitral] a rota ${o.route} não está nos stats. Entrypoints: ${names.filter((n) => n.startsWith('pages/')).join(', ') || names.join(', ')}`)
  const entries = [...SHELL.filter((n) => groups[n]), page]
  const ids = new Set(entries.flatMap((n) => groups[n].chunks ?? []).map(String))

  // Módulos de cada chunk da rota; sem `chunks[].modules`, pela lista de módulos.
  const fromChunks = (s.chunks ?? []).filter((c) => ids.has(String(c.id))).flatMap((c) => leaves(c.modules))
  const all = fromChunks.length ? fromChunks : leaves(s.modules).filter((m) => m.chunks?.some((c) => ids.has(String(c))))
  const seen = new Map<string, StatsModule>()
  for (const m of all) seen.set(m.identifier ?? m.name ?? '', m)
  const mods = [...seen.values()].filter((m) => (m.size ?? 0) > 0 && !/^(webpack\/runtime|\(webpack\))/.test(m.name ?? ''))

  const byPkg = new Map<string, number>()
  let bytes = 0
  for (const m of mods) {
    bytes += m.size!
    const p = pkgOf(m.name ?? '') ?? '(código do app)'
    byPkg.set(p, (byPkg.get(p) ?? 0) + m.size!)
  }
  const top = o.top ?? 15
  const checks: Check[] = []

  // Stats sem os módulos de todos os chunks da rota: a soma sairia baixa sem aviso.
  const routeChunks = (s.chunks ?? []).filter((c) => ids.has(String(c.id)))
  const assetSize = new Map((s.assets ?? []).map((a) => [a.name, a.size ?? 0]))
  const jsFiles = new Set([
    ...routeChunks.flatMap((c) => c.files ?? []),
    ...entries.flatMap((n) => (groups[n].assets ?? []).map((a) => (typeof a === 'string' ? a : a.name))),
  ].filter((f) => /\.m?js$/.test(f)))
  const groupAssets = new Map(entries.flatMap((n) => (groups[n].assets ?? []).flatMap((a) => (typeof a === 'string' ? [] : [[a.name, a.size ?? 0] as const]))))
  const shipped = Math.max(
    routeChunks.reduce((n, c) => n + (c.size ?? 0), 0),
    [...jsFiles].reduce((n, f) => n + (assetSize.get(f) ?? groupAssets.get(f) ?? 0), 0),
  )
  if (shipped > 2 * bytes && shipped - bytes > 50 * 1024)
    checks.push({
      status: 'warn',
      title: `os stats só mostram ${KB(bytes)} dos ${KB(shipped)} que a rota carrega`,
      cause: 'os stats foram gerados sem os módulos de cada chunk; os números abaixo ficam incompletos',
      fix: "gere os stats com módulos e chunks: stats.toJson({ all: false, entrypoints: true, chunks: true, chunkModules: true, modules: true, nestedModules: true, assets: true, usedExports: true, providedExports: true, reasons: true })",
    })
  const packages = [...byPkg].map(([name, b]) => ({ name, bytes: b })).sort((a, b) => b.bytes - a.bytes)
  const short = (n: string) => n.replace(/^(.*?[/\\])?node_modules[/\\](\.pnpm[/\\][^/\\]+[/\\]node_modules[/\\])?/, 'node_modules/')
  const modules = mods.map((m) => ({ name: short(m.name ?? '?'), bytes: m.size! })).sort((a, b) => b.bytes - a.bytes)

  // Traduções: todas as línguas (ou todos os namespaces) no JS da rota.
  const locales = mods.filter((m) => LOCALE.test(m.name ?? ''))
  const localeBytes = locales.reduce((n, m) => n + m.size!, 0)
  if (localeBytes > 20 * 1024)
    checks.push({
      status: 'warn',
      title: `traduções no JS da rota: ${locales.length} arquivo(s), ${KB(localeBytes)}`,
      cause: 'cada língua e cada namespace entram no bundle, mesmo os que a página não mostra; o navegador baixa e interpreta tudo antes de hidratar',
      fix: 'carregue a língua ativa sob demanda (import() por língua ou um backend HTTP do i18next) e deixe no bundle só o idioma padrão, se precisar',
    })

  // Sem nenhum export usado: só ficam pelo efeito colateral (barrel sem `sideEffects: false`).
  const dead = mods.filter((m) => Array.isArray(m.providedExports) && m.providedExports.length > 0 && (m.usedExports === false || (Array.isArray(m.usedExports) && m.usedExports.length === 0)))
  const deadBytes = dead.reduce((n, m) => n + m.size!, 0)
  if (deadBytes > 10 * 1024) {
    const pk = [...new Set(dead.map((m) => pkgOf(m.name ?? '')).filter(Boolean))].slice(0, 5)
    checks.push({
      status: 'warn',
      title: `${dead.length} módulo(s) sem nenhum export usado na rota: ${KB(deadBytes)}`,
      cause: `o webpack só os mantém por efeito colateral${pk.length ? ` (${pk.join(', ')})` : ''}: o pacote não declara "sideEffects": false, ou um arquivo do barrel tem código no topo`,
      fix: 'declare "sideEffects": false (ou a lista dos arquivos com efeito) no package.json do pacote, ou importe do subpath em vez do barrel',
    })
  }

  // Ofertas do vitral que puxam o pacote inteiro (sem os nomes do manifesto do remote).
  const whole = mods.filter((m) => m.usedExports === true && m.reasons?.some((r) => /\.vitral[/\\]host-config/.test(r.moduleName ?? '')))
  const wholeBytes = whole.reduce((n, m) => n + m.size!, 0)
  if (wholeBytes > 10 * 1024)
    checks.push({
      status: 'warn',
      title: `ofertas de share com todos os exports: ${whole.length} módulo(s), ${KB(wholeBytes)}`,
      cause: 'a oferta foi gerada sem os nomes que o remote usa: o build do host não achou o vitral.json de algum remote, ou o manifesto é de uma versão anterior à 0.10',
      fix: 'deixe o vitral.json de cada remote em public/ ou em manifestFile no build do host, e rebuilde o remote com vitral 0.10 ou mais nova',
    })

  // Pacotes que o host e o remote levam cada um a sua cópia.
  const hostPkgs = new Map(packages.map((p) => [p.name, p.bytes]))
  for (const r of o.remotes ?? []) checks.push(...overlap(resolve(cwd, r), hostPkgs, cwd))

  if (!checks.length) checks.push({ status: 'ok', title: 'nada fora do comum nos bytes da rota' })
  return { route: page, entries, bytes, packages: packages.slice(0, top), modules: modules.slice(0, top), checks }
}

/** Pacotes do remote (SBOM) que o host também leva na rota e que o remote não pede ao host. */
function overlap(path: string, host: Map<string, number>, cwd: string): Check[] {
  const dir = path.endsWith('.json') ? resolve(path, '..') : path
  const file = path.endsWith('.json') ? path : join(dir, 'vitral.json')
  let m: RemoteManifest
  try {
    m = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return [{ status: 'error', title: `remote ${path}: vitral.json não encontrado` }]
  }
  const name = m.name ?? path
  const sbom = join(dir, m.sbom?.file ?? 'sbom.cdx.json')
  if (!existsSync(sbom))
    return [{ status: 'warn', title: `${name}: sem SBOM, não dá para cruzar os pacotes`, fix: 'gere o remote com vitral({ sbom: true }) para listar o que ele leva no bundle' }]
  const comps: { name: string; version?: string; group?: string }[] = JSON.parse(readFileSync(sbom, 'utf8')).components ?? []
  const shared = new Set((m.dedupe ?? []).map((d) => d.name))
  const groupOf = (p: string) => (p === 'react-dom' || p === 'scheduler' ? 'react' : p)
  const both = comps
    .map((c) => (c.group ? `${c.group}/${c.name}` : c.name))
    .filter((p) => host.has(p) && !shared.has(groupOf(p)))
    .map((p) => ({ p, bytes: host.get(p)!, version: installedVersion(cwd, p), remote: comps.find((c) => (c.group ? `${c.group}/${c.name}` : c.name) === p)?.version }))
    .sort((a, b) => b.bytes - a.bytes)
  if (!both.length) return [{ status: 'ok', title: `${name}: nenhum pacote em dobro com o host nesta rota` }]
  const list = both.slice(0, 8).map((b) => `${b.p} (${KB(b.bytes)} no host; ${b.version ?? '?'} no host, ${b.remote ?? '?'} no remote)`)
  const same = both.filter((b) => b.version && b.remote && b.version.split('.')[0] === b.remote.split('.')[0]).map((b) => b.p)
  return [
    {
      status: 'warn',
      title: `${name}: ${both.length} pacote(s) que o host e o remote levam cada um: ${list.join(', ')}`,
      cause: 'a página baixa e interpreta duas cópias do mesmo pacote',
      fix: same.length
        ? `ofereça no host com share: ${JSON.stringify(same.slice(0, 8))} e ponha no dedupe do remote; as versões têm o mesmo major`
        : 'alinhe as versões (major diferente não divide a cópia) e depois ponha em share/dedupe',
    },
  ]
}

function installedVersion(cwd: string, pkg: string): string | undefined {
  try {
    return JSON.parse(readFileSync(join(cwd, 'node_modules', pkg, 'package.json'), 'utf8')).version
  } catch {}
}

/** Saída legível. */
export function formatRoute(r: RouteReport): string {
  const mark = { ok: '✓', warn: '!', error: '✗' } as const
  const lines = [`Rota ${r.route} (${r.entries.join(' + ')}): ${KB(r.bytes)} de código-fonte`, '', 'Pacotes que mais pesam']
  for (const p of r.packages) lines.push(`  ${KB(p.bytes).padStart(7)}  ${p.name}`)
  lines.push('', 'Módulos que mais pesam')
  for (const m of r.modules) lines.push(`  ${KB(m.bytes).padStart(7)}  ${m.name}`)
  lines.push('')
  for (const c of r.checks) {
    lines.push(`  ${mark[c.status]} ${c.title}`)
    if (c.cause) lines.push(`      Causa: ${c.cause}`)
    if (c.fix) lines.push(`      O que fazer: ${c.fix}`)
  }
  return lines.join('\n')
}
