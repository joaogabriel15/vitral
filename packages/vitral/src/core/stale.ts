/**
 * `maxStale`: usa o manifesto salvo na última visita, se tiver até N
 * segundos, e guarda o que a rede trouxer para a próxima visita.
 */
import type { RemoteManifest } from './types'

export function stale(url: string, fresh: Promise<RemoteManifest>, maxStale: number): RemoteManifest | Promise<RemoteManifest> {
  const key = 'vitral:manifest:' + url
  fresh.then((m) => (localStorage[key] = JSON.stringify({ t: Date.now(), m }))).catch(() => {})
  try {
    const saved = JSON.parse(localStorage[key])
    if (Date.now() - saved.t < maxStale * 1e3) return saved.m
  } catch {}
  return fresh
}
