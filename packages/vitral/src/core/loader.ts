import { prefetchCss } from './css'
import { RemoteError } from './errors'
import { verifyIntegrity } from './integrity'
import { checkOrigin } from './registry'
import type { SplitBuild } from './sri'
import { protocol, type LoadedRemote } from './state'
import type { Isolation, Props, RemoteEntry, RemoteManifest, RemoteModule } from './types'
import { absolute, fetchBytes, fetchJson, withRetry, withTimeout } from './util'

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

/** `isolate` diz como o CSS vai ser aplicado, para baixá-lo do jeito certo. */
export function load(name: string, isolate?: Isolation): Promise<LoadedRemote> {
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
      const resolved = await resolveEntry(name, entry as RemoteEntry & { url: string })
      // O CSS baixa junto com o JS; a montagem espera os dois.
      prefetchCss(resolved.css, (isolate ?? resolved.isolate ?? p.settings().isolate) === 'shadow', resolved.sri)
      const module = await withRetry(p.settings().retries, () => importModule(name, resolved))
      return { ...resolved, module }
    } catch (e: any) {
      throw e instanceof RemoteError ? e : new RemoteError('LOAD_FAILED', name, String(e?.message ?? e), e)
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

type Resolved = Omit<LoadedRemote, 'module'> & { integrity?: string; split?: SplitBuild }

/** Arquivos únicos que já falharam: o mapa de módulos pode guardar o erro, então só `blob:`. */
const failed = new Set<string>()

async function resolveEntry(name: string, entry: RemoteEntry & { url: string }): Promise<Resolved> {
  checkOrigin(name, entry.url)
  // O manifesto é o único arquivo sem hash no nome: sempre revalida, para
  // nunca usar um deploy velho (o resto pode ter cache eterno). Um manifesto
  // embutido no registro do host poupa essa ida e volta.
  const m: RemoteManifest =
    entry.manifest ??
    (new URL(entry.url).pathname.endsWith('.json')
      ? await fetchJson<RemoteManifest>(entry.url, protocol().settings().timeout, name, 'no-cache')
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
    split: m.split && !entry.integrity ? { entry: abs(m.split.entry), chunks: (m.split.chunks ?? []).map(abs), sri } : undefined,
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
  const { entry, integrity } = r
  const run = (url: string) => withTimeout(timeout, name, import(/* @vite-ignore */ /* webpackIgnore: true */ url))
  let ns: any
  if (integrity && !failed.has(entry)) {
    try {
      // Caminhos 1 e 2: o navegador confere o hash e o JS roda da própria URL.
      const url = await (await paths)?.verified(r.split ?? { entry, chunks: [], sri: { [entry]: integrity } })
      if (url) ns = await run(url)
    } catch {
      failed.add(entry)
    }
  }
  if (!ns) {
    let url = entry
    let revoke: string | null = null
    if (integrity) {
      const bytes = await fetchBytes(url, timeout, name)
      await verifyIntegrity(name, bytes, integrity)
      // Caminho 3: executa exatamente os bytes verificados.
      url = revoke = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }))
    }
    try {
      ns = await run(url)
    } catch (e) {
      if (e instanceof RemoteError) throw e
      throw new RemoteError('LOAD_FAILED', name, `falha ao importar ${entry}`, e)
    } finally {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }
  return toModule(name, ns)
}

function toModule(name: string, ns: any): RemoteModule {
  const mod = ns?.default ?? ns
  if (typeof mod?.mount !== 'function') throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount(). Use defineRemote() no remote.')
  return mod
}
