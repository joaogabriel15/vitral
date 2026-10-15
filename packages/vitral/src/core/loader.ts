import { prefetchCss } from './css'
import { isRemoteError, RemoteError } from './errors'
import { checkOrigin } from './registry'
import type { SplitBuild, Verifiable } from './sri'
import { protocol, type LoadedRemote } from './state'
import type { Isolation, Props, RemoteEntry, RemoteManifest, RemoteModule } from './types'
import { absolute, fetchJson, metric, withRetry, withTimeout } from './util'

/** Baixa (uma vez só) e devolve o módulo de um remote. */
export function loadRemote<P extends Props = Props>(name: string): Promise<RemoteModule<P>> {
  return load(name).then((r) => r.module as unknown as RemoteModule<P>)
}

/** Começa a baixar um remote (JS e CSS) sem montar (ex.: no hover de um link). */
export function preload(name: string): void {
  load(name).catch(() => {})
}

// Os caminhos de SRI sem `blob:` ficam num módulo à parte, fora do host
// mínimo. Ele baixa junto com o primeiro manifesto; sem ele, vale o `blob:`.
let paths: Promise<typeof import('./sri') | null> | undefined

/**
 * `isolate` diz como o CSS vai ser aplicado, para baixá-lo do jeito certo.
 * `priority: 'high'` vira `fetchpriority` nos downloads (remote que aparece
 * logo ao abrir a página).
 */
export function load(name: string, isolate?: Isolation, priority?: RequestPriority): Promise<LoadedRemote> {
  const p = protocol()
  return p.load(name, async () => {
    paths ??= import('./sri').catch(() => null)
    try {
      await p.pending()
      // Override troca a URL e descarta a integrity do host; o isolamento continua.
      const override = await devOverride(name)
      const entry = override ? { isolate: p.entry(name)?.isolate, ...override } : p.entry(name)
      if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
      if (entry.module) return await loadLocal(name, entry)
      let t = performance.now()
      const resolved = await resolveEntry(name, entry as RemoteEntry & { url: string }, priority)
      metric(name, 'manifest', t)
      // O CSS baixa junto com o JS; a montagem espera os dois.
      prefetchCss(resolved.css, (isolate ?? resolved.isolate ?? p.settings().isolate) === 'shadow', resolved.sri, priority)
      t = performance.now()
      const module = await withRetry(p.settings().retries, () => importModule(name, resolved))
      metric(name, 'js', t)
      return { ...resolved, module }
    } catch (e: any) {
      throw isRemoteError(e) ? e : new RemoteError('LOAD_FAILED', name, String(e?.message ?? e), e)
    }
  })
}

/**
 * Override de desenvolvimento (`?vitral=` ou localStorage). O código fica em
 * outro módulo, baixado só quando a página pede um override.
 */
function devOverride(name: string): Promise<RemoteEntry | undefined> | undefined {
  try {
    if (/vitral/.test(location.search + localStorage.getItem('vitral:overrides'))) return import('./overrides').then((m) => m.overrideFor(name))
  } catch {}
}

async function loadLocal(name: string, entry: RemoteEntry): Promise<LoadedRemote> {
  let mod: any = entry.module
  if (typeof mod === 'function') mod = await mod()
  return { module: toModule(name, mod), entry: typeof location !== 'undefined' ? location.href : 'http://localhost/', css: entry.css ?? [], isolate: entry.isolate }
}

type Resolved = Omit<LoadedRemote, 'module'> & { integrity?: string; split?: SplitBuild; priority?: RequestPriority }

async function resolveEntry(name: string, entry: RemoteEntry & { url: string }, priority?: RequestPriority): Promise<Resolved> {
  checkOrigin(name, entry.url)
  // O manifesto é o único arquivo sem hash no nome: sempre revalida, para
  // nunca usar um deploy velho (o resto pode ter cache eterno). Um manifesto
  // embutido no registro do host poupa essa ida e volta.
  const m: RemoteManifest =
    entry.manifest ??
    (new URL(entry.url).pathname.endsWith('.json')
      ? await fetchJson<RemoteManifest>(entry.url, protocol().settings().timeout, name, { cache: 'no-cache', priority })
      : { name, entry: entry.url })
  if (typeof m?.entry !== 'string') throw new RemoteError('INVALID_MODULE', name, `manifesto inválido em ${entry.url}`)
  const abs = (u: string) => absolute(u, entry.url)
  const sri: Record<string, string> = {}
  for (const file in m.files ?? {}) sri[abs(file)] = m.files![file]
  const resolved: Resolved = {
    entry: abs(m.entry),
    css: [...(m.css ?? []), ...(entry.css ?? [])].map(abs),
    // A integridade declarada pelo host vence a do manifesto, e aí só o
    // arquivo único (o que ela descreve) é usado.
    integrity: entry.integrity ?? m.integrity,
    isolate: entry.isolate,
    scope: m.scope,
    sri,
    priority,
    split: m.split && !entry.integrity ? { entry: abs(m.split.entry), chunks: (m.split.chunks ?? []).map(abs), sri, priority } : undefined,
  }
  checkOrigin(name, resolved.entry)
  if (resolved.split) checkOrigin(name, resolved.split.entry)
  // Remote vindo de `src` (nome = URL): o nome do manifesto vira apelido.
  if (name === entry.url && m.name) {
    const override = await devOverride(m.name)
    if (override) return { ...(await resolveEntry(name, override as RemoteEntry & { url: string })), name: m.name }
    resolved.name = m.name
    if (!protocol().entry(m.name)) protocol().register(m.name, entry)
  }
  return resolved
}

async function importModule(name: string, r: Resolved): Promise<RemoteModule> {
  const { timeout } = protocol().settings()
  const run = (url: string) =>
    withTimeout(timeout, name, import(/* @vite-ignore */ /* webpackIgnore: true */ url)).catch((e) => {
      throw isRemoteError(e) ? e : new RemoteError('LOAD_FAILED', name, `falha ao importar ${r.entry}`, e)
    })
  if (!r.integrity) return toModule(name, await run(r.entry))
  // Com integrity, a conferência mora no módulo de SRI. Sem ele, nada roda.
  const sri = await paths
  if (!sri) throw new RemoteError('LOAD_FAILED', name, 'não foi possível carregar o verificador de integrity')
  return toModule(name, await sri.importVerified(name, r as Verifiable, run, timeout))
}

function toModule(name: string, ns: any): RemoteModule {
  const mod = ns?.default ?? ns
  if (typeof mod?.mount !== 'function') throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount(). Use defineRemote() no remote.')
  return mod
}
