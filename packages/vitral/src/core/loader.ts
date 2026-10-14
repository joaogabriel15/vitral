import { RemoteError } from './errors'
import { verifyIntegrity } from './integrity'
import { checkOrigin } from './registry'
import { protocol, type LoadedRemote } from './state'
import type { Props, RemoteEntry, RemoteManifest, RemoteModule } from './types'
import { absolute, fetchBytes, fetchJson, withRetry, withTimeout } from './util'

/** Baixa (uma vez só) e devolve o módulo de um remote. */
export function loadRemote<P extends Props = Props>(name: string): Promise<RemoteModule<P>> {
  return load(name).then((r) => r.module as unknown as RemoteModule<P>)
}

/** Começa a baixar um remote sem montar (ex.: no hover de um link). */
export function preload(name: string): void {
  load(name).catch(() => {})
}

export function load(name: string): Promise<LoadedRemote> {
  const p = protocol()
  return p.load(name, async () => {
    try {
      await p.pending()
      // Override troca a URL e descarta a integrity do host; o isolamento continua.
      const override = await devOverride(name)
      const entry = override ? { isolate: p.entry(name)?.isolate, ...override } : p.entry(name)
      if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
      if (entry.module) return await loadLocal(name, entry)
      const { integrity, ...resolved } = await resolveEntry(name, entry as RemoteEntry & { url: string })
      const module = await withRetry(p.settings().retries, () => importModule(name, resolved.entry, integrity))
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
  mod = mod?.default ?? mod
  if (typeof mod?.mount !== 'function') throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount()')
  return { module: mod, entry: typeof location !== 'undefined' ? location.href : 'http://localhost/', css: entry.css ?? [], isolate: entry.isolate }
}

type Resolved = Omit<LoadedRemote, 'module'> & { integrity?: string }

async function resolveEntry(name: string, entry: RemoteEntry & { url: string }): Promise<Resolved> {
  checkOrigin(name, entry.url)
  const isManifest = new URL(entry.url).pathname.endsWith('.json')
  if (!isManifest) {
    return { entry: entry.url, css: (entry.css ?? []).map((c) => absolute(c, entry.url)), integrity: entry.integrity, isolate: entry.isolate }
  }
  // O manifesto é o único arquivo sem hash no nome: sempre revalida, para
  // nunca usar um deploy velho (o resto pode ter cache eterno).
  const m = await fetchJson<RemoteManifest>(entry.url, protocol().settings().timeout, name, 'no-cache')
  if (!m || typeof m.entry !== 'string') throw new RemoteError('INVALID_MODULE', name, `manifesto inválido em ${entry.url}`)
  const resolved: Resolved = {
    entry: absolute(m.entry, entry.url),
    css: [...(m.css ?? []), ...(entry.css ?? [])].map((c) => absolute(c, entry.url)),
    // A integridade declarada pelo host vence a do manifesto.
    integrity: entry.integrity ?? m.integrity,
    isolate: entry.isolate,
    scope: m.scope,
  }
  checkOrigin(name, resolved.entry)
  // Remote vindo de `src` (nome = URL): o nome do manifesto vira apelido.
  if (name === entry.url && m.name) {
    const override = await devOverride(m.name)
    if (override) return { ...(await resolveEntry(name, override as RemoteEntry & { url: string })), name: m.name }
    resolved.name = m.name
    if (!protocol().entry(m.name)) protocol().register(m.name, entry)
  }
  return resolved
}

async function importModule(name: string, entry: string, integrity?: string): Promise<RemoteModule> {
  const { timeout } = protocol().settings()
  let url = entry
  let revoke: string | null = null
  if (integrity) {
    const bytes = await fetchBytes(url, timeout, name)
    await verifyIntegrity(name, bytes, integrity)
    // Executa exatamente os bytes verificados.
    url = revoke = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }))
  }
  try {
    const ns = await withTimeout(timeout, name, import(/* @vite-ignore */ /* webpackIgnore: true */ url))
    const mod = (ns.default ?? ns) as RemoteModule
    if (typeof mod?.mount !== 'function') {
      throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount(). Use defineRemote() no remote.')
    }
    return mod
  } catch (e) {
    if (e instanceof RemoteError) throw e
    throw new RemoteError('LOAD_FAILED', name, `falha ao importar ${entry}`, e)
  } finally {
    if (revoke) URL.revokeObjectURL(revoke)
  }
}
