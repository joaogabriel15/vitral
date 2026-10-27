/**
 * Para o service worker do host: os arquivos que um remote publica, para
 * guardar no cache e o remote abrir offline.
 *
 *   // sw.js do host
 *   import { remoteFiles } from 'vitral/sw'
 *   self.addEventListener('install', (e) => e.waitUntil(
 *     remoteFiles('/delivery-remote/vitral.json').then((urls) => caches.open('remotes').then((c) => c.addAll(urls))),
 *   ))
 */
import type { RemoteManifest } from './core/types'

/**
 * URLs absolutas do manifesto e de tudo que ele lista: arquivo único, CSS,
 * build dividido (inclusive os `import()` das rotas), cópias de `dedupe` e os
 * módulos de teste do SRI.
 */
export async function remoteFiles(manifestUrl: string, init?: RequestInit): Promise<string[]> {
  const base = new URL(manifestUrl, globalThis.location?.href)
  const res = await fetch(base, { cache: 'no-cache', ...init })
  if (!res.ok) throw new Error(`vitral: ${base.href} respondeu ${res.status}`)
  const m: RemoteManifest = await res.json()
  const files = [
    m.entry,
    ...(m.css ?? []),
    ...(m.shadow?.css ?? []),
    ...(m.shadow?.global ?? []),
    ...Object.keys(m.files ?? {}),
    ...(m.split ? [m.split.entry, ...(m.split.chunks ?? [])] : []),
    ...(m.dedupe ?? []).flatMap((d) => [d.file, ...(d.chunks ?? [])]),
    ...(m.probe ?? []),
  ]
  return [base.href, ...new Set(files.filter(Boolean).map((f) => new URL(f, base).href))]
}
