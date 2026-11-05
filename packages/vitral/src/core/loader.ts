import { dedupeModule, sriModule } from './bundled'
import { prefetchCss } from './css'
import { fail, isRemoteError, RemoteError, report } from './errors'
import { policy } from './policy'
import { checkOrigin } from './registry'
import type { SplitBuild, Verifiable } from './sri'
import { protocol, type LoadedRemote } from './state'
import type { Isolation, Props, RemoteEntry, RemoteManifest, RemoteModule } from './types'
import { absolute, fetchJson, metric, withRetry, withTimeout } from './util'
import type { Translations } from './i18n'

declare const __VITRAL_EMBED__: true | undefined

/** Baixa (uma vez só) e devolve o módulo de um remote. */
export function loadRemote<P extends Props = Props>(name: string): Promise<RemoteModule<P>> {
  return load(name).then((r) => r.module as unknown as RemoteModule<P>)
}

/**
 * Carrega um módulo sem UI que um remote expõe (funções, stores, constantes),
 * com a mesma verificação de SRI e de origem dos componentes.
 *
 *   const api = await loadModule<typeof import('./tipos/carrinho-api')>('carrinho/api')
 *
 * Sem `/`, devolve os exports do arquivo principal do remote.
 */
export function loadModule<T = Record<string, unknown>>(name: string): Promise<T> {
  return import('./expose')
    .then((m) => m.resolveModule<T>(name, (n) => loadFile(n)))
    .catch(fail)
}

/** Começa a baixar um remote (JS e CSS) sem montar (ex.: no hover de um link). */
export function preload(name: string, options: PreloadOptions = {}): void {
  const done = load(name)
  done.catch(() => {})
  if (options.routes) done.then(warmRoutes, () => {})
}

export interface PreloadOptions {
  /**
   * Depois do remote, aquece no cache HTTP, com o navegador ocioso, os
   * chunks que ele só carrega depois (`import()` das rotas). Não baixa as
   * cópias de `dedupe`. Padrão: false.
   */
  routes?: boolean
}

/** Os JS do build dividido que a montagem não baixou: as rotas e partes lazy. */
export function routeChunks(r: LoadedRemote & { split?: SplitBuild }): string[] {
  const s = r.split
  if (!s) return []
  if (s.lazy) return s.lazy
  // Manifesto sem `lazy` (builds antigos): o que sobra, menos as cópias de dedupe e o que elas usam.
  const dir = s.entry.slice(0, s.entry.lastIndexOf('/') + 1)
  const loaded = new Set([s.entry, ...s.chunks, ...(s.probe ?? []), ...(s.dedupe ?? []).flatMap((d) => [d.file, ...(d.chunks ?? [])])])
  return Object.keys(r.sri ?? {}).filter((u) => u.startsWith(dir) && u.endsWith('.js') && !loaded.has(u))
}

export function warmRoutes(r: LoadedRemote): void {
  // Rede lenta, economia de dados ou aparelho fraco: não baixa o que talvez nem seja usado.
  if (policy() !== 'all') return
  const queue = routeChunks(r).slice()
  // O corpo precisa ser lido: resposta grande largada no meio não fica no cache HTTP.
  const next = (): unknown => queue.length && fetch(queue.shift()!, { priority: 'low' } as RequestInit).then((res) => res.arrayBuffer()).catch(() => {}).then(next)
  // Três downloads por vez: não disputa a banda com o que a página pede.
  const run = () => [0, 0, 0].map(next)
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 10000 })
  else setTimeout(run, 1)
}

// Os caminhos de SRI sem `blob:` ficam num módulo à parte, fora do host
// mínimo. Ele baixa junto com o primeiro manifesto; sem ele, vale o `blob:`.
let paths: Promise<typeof import('./sri') | null> | undefined

/**
 * Baixa o código de SRI e o de dedupe junto com o primeiro manifesto. O de
 * dedupe só é preciso se o manifesto pedir, mas esperar o manifesto para
 * pedi-lo custava uma ida e volta antes da cópia do framework.
 */
function warm(): void {
  if (paths) return
  paths = sriModule().catch(() => null)
  dedupeModule().catch(() => {})
}

/**
 * Página com SSR do gateway (`holder` é o `[data-vitral-ssr]`): o código de SRI
 * e, se o manifesto no HTML usa dedupe, o de dedupe começam a baixar junto com
 * o da hidratação, e não um depois do outro.
 */
export function warmSsr(holder: Element): void {
  paths ??= sriModule().catch(() => null)
  if (holder.querySelector('script[data-vitral-manifest]')?.textContent?.includes('"dedupe"')) dedupeModule().catch(() => {})
}

/**
 * `isolate` diz como o CSS vai ser aplicado, para baixá-lo do jeito certo.
 * `priority: 'high'` vira `fetchpriority` nos downloads (remote que aparece
 * logo ao abrir a página).
 */
export function load(name: string, isolate?: Isolation, priority?: RequestPriority): Promise<LoadedRemote> {
  const file = (n: string) => loadFile(n, isolate, priority)
  // Partes (`carrinho/MiniCarrinho`) ficam num módulo à parte, fora do host mínimo.
  return (
    protocol().entry(name) || !name.includes('/') ? file(name).then((r) => mountable(name, r)) : import('./expose').then((m) => m.resolveTarget(name, file))
  ).catch(fail)
}

/** Baixa o arquivo de um remote registrado, sem conferir o formato (base de `load` e `loadModule`). */
export function loadFile(name: string, isolate?: Isolation, priority?: RequestPriority): Promise<LoadedRemote> {
  const p = protocol()
  return p.load(name, async () => {
    warm()
    let resolved: Resolved | undefined
    try {
      // O manifesto já baixa enquanto as ofertas de dedupe se registram.
      const known = p.entry(name)
      const early = known?.url && !known.module && !known.manifest && !overrides() ? prefetchManifest(known.url, name, priority, signed(known)) : undefined
      await p.pending()
      // Override troca a URL e descarta a integrity do host; o isolamento continua.
      const override = await devOverride(name)
      const entry = override ? { isolate: p.entry(name)?.isolate, ...override } : p.entry(name)
      if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
      if (entry.module) return await loadLocal(name, entry)
      let t = performance.now()
      resolved = await resolveEntry(name, entry as RemoteEntry & { url: string }, priority, entry.url === known?.url ? early : undefined)
      metric(name, 'manifest', t)
      // O boot do remote confere, com isto, que a oferta do host tem os nomes que ele usa.
      const d = resolved.split?.dedupe
      if (d?.some((x) => x.uses)) (p.uses ??= {})[resolved.split!.entry] = Object.fromEntries(d.map((x) => [x.name, x.uses]))
      // O CSS baixa junto com o JS; a montagem espera os dois.
      prefetchCss(resolved, (isolate ?? resolved.isolate ?? p.settings().isolate) === 'shadow', priority)
      // As traduções da língua aberta também: a montagem espera, para a primeira tela já vir traduzida.
      const { i18n, timeout } = p.settings()
      // O embed (widget em site de terceiros) não tem i18n do host: o módulo fica fora do arquivo único.
      const words = typeof __VITRAL_EMBED__ === 'undefined' && resolved.i18n && i18n && import('./i18n').then((m) => m.loadTranslations(name, resolved!.i18n!, resolved!.sri ?? {}, i18n, timeout, priority)).catch((e) => console.warn(`[vitral] ${name}: traduções não carregaram`, e))
      t = performance.now()
      const ns = await withRetry(p.settings().retries, () => importModule(name, resolved!))
      await words
      metric(name, 'js', t)
      return { ...resolved, module: ns?.default ?? ns, exports: ns }
    } catch (e: any) {
      throw report(isRemoteError(e) ? e : new RemoteError('LOAD_FAILED', name, String(e?.message ?? e), e), resolved)
    }
  })
}

/**
 * Override de desenvolvimento (`?vitral=`, sessionStorage ou localStorage). O
 * código fica em outro módulo, baixado só quando a página pede um override.
 */
function devOverride(name: string): Promise<RemoteEntry | undefined> | undefined {
  if (overrides()) return import('./overrides').then((m) => m.overrideFor(name))
}

function overrides(): boolean | undefined {
  try {
    const k = 'vitral:overrides'
    return /[?&]vitral=/.test(location.search) || !!(localStorage[k] || sessionStorage[k])
  } catch {}
}

async function loadLocal(name: string, entry: RemoteEntry): Promise<LoadedRemote> {
  let ns: any = entry.module
  if (typeof ns === 'function') ns = await ns()
  return { module: ns?.default ?? ns, exports: ns, entry: typeof location !== 'undefined' ? location.href : 'http://localhost/', css: entry.css ?? [], isolate: entry.isolate }
}

type Resolved = Omit<LoadedRemote, 'module'> & { integrity?: string; split?: SplitBuild; priority?: RequestPriority; i18n?: Translations }

/** `early`: o manifesto já pedido por `loadFile` para esta URL. */
export async function resolveEntry(name: string, entry: RemoteEntry & { url: string }, priority?: RequestPriority, early?: Promise<RemoteManifest>): Promise<Resolved> {
  checkOrigin(name, entry.url)
  // O manifesto é o único arquivo sem hash no nome: sempre revalida, para
  // nunca usar um deploy velho (o resto pode ter cache eterno). Um manifesto
  // embutido no registro do host poupa essa ida e volta.
  const keys = signed(entry)
  const m: RemoteManifest =
    entry.manifest ??
    (new URL(entry.url).pathname.endsWith('.json')
      ? await (early ?? manifestOf(entry.url, name, priority, keys))
      : { name, entry: entry.url })
  // Canal (`{ stable, canary }`): escolhe a versão e segue pelo manifesto dela.
  if ((m as any)?.stable) return resolveEntry(name, await (await import('./channel')).pick(name, entry, m as any), priority)
  if (typeof m?.entry !== 'string') throw new RemoteError('INVALID_MODULE', name, `manifesto inválido em ${entry.url}`)
  // Contrato: com os dois lados declarando, confere antes de executar o remote.
  if (m.contract && (entry.contract || protocol().settings().contract)) {
    const why = await (await import('./contract')).checkContract(m.contract, entry.contract)
    if (why) throw new RemoteError('CONTRACT_MISMATCH', name, why)
  }
  const abs = (u: string) => absolute(u, entry.url)
  const sri: Record<string, string> = {}
  // Com `keys`, cada arquivo também precisa da assinatura do remote (Chrome 141+; os outros navegadores ignoram).
  for (const file in m.files ?? {}) sri[abs(file)] = m.files![file] + keys
  const resolved: Resolved = {
    entry: abs(m.entry),
    css: [...(m.css ?? []), ...(entry.css ?? [])].map(abs),
    shadow: m.shadow,
    // A integridade declarada pelo host vence a do manifesto, e aí só o
    // arquivo único (o que ela descreve) é usado.
    integrity: entry.integrity === false ? undefined : (entry.integrity ?? (m.integrity && m.integrity + keys)),
    isolate: entry.isolate,
    scope: m.scope,
    version: m.version,
    sri,
    priority,
    // As URLs viram absolutas no módulo das traduções, que só baixa quando há o que traduzir.
    ...(m.i18n && { i18n: { files: m.i18n, base: entry.url } }),
    split:
      m.split && typeof entry.integrity !== 'string'
        ? {
            entry: abs(m.split.entry),
            chunks: (m.split.chunks ?? []).map(abs),
            ...(m.split.lazy && { lazy: m.split.lazy.map(abs) }),
            sri,
            priority,
            ...(m.probe && { probe: m.probe.map(abs) as [string, string] }),
            dedupe: m.dedupe?.map((d) => ({ ...d, file: abs(d.file), chunks: d.chunks?.map(abs) })),
          }
        : undefined,
  }
  checkOrigin(name, resolved.entry)
  for (const u of [resolved.split?.entry, ...(resolved.split?.dedupe ?? []).map((d) => d.file)]) if (u) checkOrigin(name, u)
  // Remote vindo de `src` (nome = URL): o nome do manifesto vira apelido.
  if (name === entry.url && m.name) {
    const override = await devOverride(m.name)
    if (override) return { ...(await resolveEntry(name, override as RemoteEntry & { url: string })), name: m.name }
    resolved.name = m.name
    if (!protocol().entry(m.name)) protocol().register(m.name, entry)
  }
  return resolved
}

/** ` ed25519-…` de cada chave pública do remote, para somar aos hashes. */
const signed = (e: RemoteEntry): string => (e.keys ?? []).map((k) => ' ed25519-' + k).join('')

/** Pede o manifesto antes das ofertas de dedupe; nada se a origem não é permitida. */
function prefetchManifest(url: string, name: string, priority: RequestPriority | undefined, keys: string): Promise<RemoteManifest> | undefined {
  try {
    if (!new URL(url).pathname.endsWith('.json')) return
    checkOrigin(name, url)
  } catch {
    return
  }
  const f = manifestOf(url, name, priority, keys)
  f.catch(() => {})
  return f
}

/**
 * Com `maxStale`, a cópia salva do manifesto pode valer sem esperar a rede
 * (`./stale`, um módulo à parte que baixa junto com o manifesto).
 */
function manifestOf(url: string, name: string, priority: RequestPriority | undefined, keys: string): Promise<RemoteManifest> {
  const { timeout, maxStale } = protocol().settings()
  // `same-origin`, o modo do `<link rel="preload" crossorigin>` que o host põe
  // no HTML: sem ele o navegador baixa o manifesto de novo. Para outra origem
  // continua sem cookies. Com `keys`, o navegador confere a assinatura do manifesto.
  // Com o preload no HTML, sem `no-cache`: o Safari só reaproveita o preload
  // quando o `cache` do fetch é o padrão, e o preload acabou de baixar.
  const hinted = typeof document != 'undefined' && [...document.querySelectorAll<HTMLLinkElement>('link[as=fetch]')].some((l) => l.href == url)
  const fresh = fetchJson<RemoteManifest>(url, timeout, name, { ...(!hinted && { cache: 'no-cache' }), credentials: 'same-origin', priority, integrity: keys.slice(1) })
  return maxStale ? import('./stale').then((m) => m.stale(url, fresh, maxStale), () => fresh) : fresh
}

/** Arquivos sem integrity que falharam, com o número de tentativas. */
const plainFailed = new Map<string, number>()

/** Namespace ES do arquivo do remote. */
async function importModule(name: string, r: Resolved): Promise<any> {
  const { timeout } = protocol().settings()
  const run = (url: string) =>
    withTimeout(timeout, name, import(/* @vite-ignore */ /* webpackIgnore: true */ url)).catch((e) => {
      throw isRemoteError(e) ? e : new RemoteError('LOAD_FAILED', name, `falha ao importar ${r.entry}`, e)
    })
  // Sem hash a conferir, o build dividido baixa só o que a primeira tela usa
  // e pega as dependências de dedupe da página, como no caminho com SRI.
  if (!r.integrity) {
    // O mapa de módulos guarda o erro de uma URL que falhou: depois de uma
    // falha, o arquivo único, e depois por uma URL nova.
    const n = plainFailed.get(r.entry)
    const again = (e: unknown, next: number) => {
      plainFailed.set(r.entry, next)
      throw e
    }
    if (n != null || !r.split) return run(n ? r.entry + (r.entry.includes('?') ? '&' : '?') + 'vitral-retry=' + n : r.entry).catch((e) => again(e, (n ?? 0) + 1))
    if (r.split.dedupe?.length) {
      const { shared, planned } = await dedupeModule()
      for (const d of planned(name, r.split).dedupe!)
        shared(protocol())(d.name, d.range, { version: d.version, url: d.file, load: async () => (await run(d.file)).default })
    }
    return run(r.split.entry).catch((e) => again(e, 0))
  }
  // Com integrity, a conferência mora no módulo de SRI. Sem ele, nada roda.
  const sri = await paths
  if (!sri) throw new RemoteError('LOAD_FAILED', name, 'não foi possível carregar o verificador de integrity')
  return sri.importVerified(name, r as Verifiable, run, timeout)
}

export function mountable(name: string, r: LoadedRemote): LoadedRemote {
  if (typeof r.module?.mount != 'function') {
    throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount(). Use defineRemote(), ou loadModule() para módulo sem UI.')
  }
  return r
}
