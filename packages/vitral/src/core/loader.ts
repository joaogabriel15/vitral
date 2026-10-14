import { RemoteError } from './errors'
import { resolveModule, resolveTarget } from './expose'
import { verifyIntegrity } from './integrity'
import { checkOrigin } from './registry'
import { protocol, type LoadedRemote } from './state'
import type { Props, RemoteEntry, RemoteManifest, RemoteModule } from './types'
import { absolute, fetchBytes, fetchJson, withRetry, withTimeout } from './util'

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
  return resolveModule<T>(name, loadFile)
}

/** Começa a baixar um remote sem montar (ex.: no hover de um link). */
export function preload(name: string): void {
  load(name).catch(() => {})
}

/** Baixa um remote ou um dos componentes que ele expõe (`carrinho/MiniCarrinho`). */
export function load(name: string): Promise<LoadedRemote> {
  return resolveTarget(name, loadFile)
}

/** Baixa o arquivo de um remote registrado, sem conferir o formato. */
export function loadFile(name: string): Promise<LoadedRemote> {
  const p = protocol()
  return p.load(name, async () => {
    try {
      await p.pending()
      const entry = p.entry(name)
      if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
      if (entry.module) return await loadLocal(name, entry)
      const { integrity, ...resolved } = await resolveEntry(name, entry as RemoteEntry & { url: string })
      const loaded = await withRetry(p.settings().retries, () => importModule(name, resolved.entry, integrity))
      return { ...resolved, ...loaded }
    } catch (e: any) {
      throw e instanceof RemoteError ? e : new RemoteError('LOAD_FAILED', name, String(e?.message ?? e), e)
    }
  })
}

async function loadLocal(name: string, entry: RemoteEntry): Promise<LoadedRemote> {
  let ns: any = entry.module
  if (typeof ns === 'function') ns = await ns()
  return { module: ns?.default ?? ns, exports: ns, entry: typeof location !== 'undefined' ? location.href : 'http://localhost/', css: entry.css ?? [], isolate: entry.isolate }
}

type Resolved = Omit<LoadedRemote, 'module'> & { integrity?: string }

export async function resolveEntry(name: string, entry: RemoteEntry & { url: string }): Promise<Resolved> {
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
  return resolved
}

async function importModule(name: string, entry: string, integrity?: string): Promise<Pick<LoadedRemote, 'module' | 'exports'>> {
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
    return { module: ns.default ?? ns, exports: ns }
  } catch (e) {
    if (e instanceof RemoteError) throw e
    throw new RemoteError('LOAD_FAILED', name, `falha ao importar ${entry}`, e)
  } finally {
    if (revoke) URL.revokeObjectURL(revoke)
  }
}
