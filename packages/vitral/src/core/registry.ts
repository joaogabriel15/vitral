import { RemoteError } from './errors'
import { protocol } from './state'
import type { RemoteEntry, VitralConfig } from './types'
import { absolute, fetchJson, pageOrigin } from './util'

/** Configura a lib. Pode ser chamada mais de uma vez; as opções são mescladas. */
export function configure(config: VitralConfig): void {
  const p = protocol()
  const { remotes, ...rest } = config
  p.configure(rest)
  if (typeof remotes === 'string') {
    const url = absolute(remotes)
    p.pending(
      fetchJson<Record<string, string | RemoteEntry>>(url, p.settings().timeout, 'remotes', 'no-cache').then((map) => registerAll(map, url)),
    ).catch(() => {})
  } else if (remotes) {
    registerAll(remotes)
  }
}

/** Registra (ou substitui) um remote. */
export function register(name: string, entry: string | RemoteEntry): void {
  const e: RemoteEntry = typeof entry === 'string' ? { url: entry } : entry
  if (!e.url && !e.module) throw new RemoteError('NOT_REGISTERED', name, 'informe url ou module')
  protocol().register(name, e.url ? { ...e, url: absolute(e.url) } : e)
}

/**
 * Registra a URL de um `src` e devolve o nome para montar. Sem `name`, o nome
 * é a própria URL (e o nome do manifesto vira um apelido). Com `trusted`, a
 * origem entra na allowlist mesmo com `allowedOrigins`: vale para URL escrita
 * no código do host, nunca para URL vinda de dados.
 */
export function registerSrc(src: string, name?: string, trusted = true): string {
  const p = protocol()
  const url = absolute(src)
  const key = name || url
  if (p.entry(key)?.url !== url) p.register(key, { url })
  const origin = new URL(url).origin
  const list = p.settings().trusted ?? []
  if (trusted && !list.includes(origin)) p.configure({ trusted: [...list, origin] })
  return key
}

function registerAll(map: Record<string, string | RemoteEntry>, base?: string) {
  for (const [name, entry] of Object.entries(map)) {
    const e: RemoteEntry = typeof entry === 'string' ? { url: entry } : entry
    register(name, e.url ? { ...e, url: absolute(e.url, base) } : e)
  }
}

export function checkOrigin(name: string, url: string): void {
  const p = protocol()
  const origin = new URL(url).origin
  const { allowedOrigins, trusted = [] } = p.settings()
  const allowed = [...(allowedOrigins ?? ([pageOrigin(), ...p.origins()].filter(Boolean) as string[])), ...trusted]
  if (allowed.includes('*') || allowed.includes(origin) || url.startsWith('blob:')) return
  throw new RemoteError('ORIGIN_BLOCKED', name, `origem ${origin} não está em allowedOrigins`)
}
