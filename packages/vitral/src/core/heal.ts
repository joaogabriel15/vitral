/**
 * Deploy novo com a aba aberta: os arquivos que a página conhecia sumiram.
 * Fora do host mínimo; o loader e o `ctx.reportError` baixam só quando um
 * `import()` falha.
 */
// O loader e o `updates` entram por parâmetro: um import estático deles fecharia
// um ciclo com o `import('./heal')` e o bundler do remote levaria o loader.
import { tr } from './lang'
import { abandon } from './channel'
import type { Resolved } from './loader'
import { protocol } from './state'
import type { RemoteEntry, RemoteManifest } from './types'
import { fetchJson } from './util'

type ResolveEntry = (name: string, entry: RemoteEntry & { url: string }, priority?: RequestPriority) => Promise<Resolved>

/** Remotes já trocados por causa de um chunk sumido, por página (uma vez por remote). */
const healed = new WeakMap<object, Set<string>>()

/**
 * Troca as montagens de `name` (ou do remote de que é parte) pela versão que
 * o manifesto aponta agora, se for outra. `versions`: JS montado por nome.
 */
export async function heal(name: string, versions: Map<string, string>, resolveEntry: ResolveEntry, refresh: (name: string) => Promise<void>): Promise<void> {
  const p = protocol()
  let root = name
  while (root.includes('/') && !p.entry(root)) root = root.slice(0, root.lastIndexOf('/'))
  const entry = p.entry(root)
  const done = healed.get(p) ?? new Set<string>()
  healed.set(p, done)
  if (!entry?.url || done.has(root)) return
  done.add(root)
  const r = await resolveEntry(root, entry as RemoteEntry & { url: string })
  if (r.entry === versions.get(root) || r.entry === versions.get(name)) return
  console.warn(`[vitral] ${root}: ` + tr('arquivo da versão aberta sumiu (deploy novo); trocando pela versão nova', 'a file of the open version is gone (new deploy); switching to the new version'))
  await refresh(root)
}

/** O manifesto de agora (ou a estável, se `name` estava numa canary que falhou), sem cache nem cópia salva; `undefined` se a URL não é de manifesto ou não responde. */
export async function reread(name: string, entry: RemoteEntry & { url: string }, priority: RequestPriority | undefined, resolveEntry: ResolveEntry, keys: string): Promise<Resolved | undefined> {
  if (!new URL(entry.url).pathname.endsWith('.json')) return
  // Numa versão canary, o JS que não carrega tira o usuário da canary: o canal relido aponta para a estável.
  abandon(name)
  try {
    const manifest = await fetchJson<RemoteManifest>(entry.url, protocol().settings().timeout, name, { cache: 'reload', credentials: 'same-origin', priority, integrity: keys.slice(1) })
    return await resolveEntry(name, { ...entry, manifest }, priority)
  } catch {}
}
