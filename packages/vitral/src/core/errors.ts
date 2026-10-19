import { protocol, type LoadedRemote } from './state'

export type RemoteErrorCode =
  | 'NOT_REGISTERED'
  | 'NOT_EXPOSED'
  | 'ORIGIN_BLOCKED'
  | 'TIMEOUT'
  | 'INTEGRITY'
  | 'INVALID_MODULE'
  | 'LOAD_FAILED'
  | 'MOUNT_FAILED'
  | 'RENDER_FAILED'
  | 'SHARED_READONLY'
  | 'CONTRACT_MISMATCH'

/** Endereço das páginas de erro no site. A página de cada código é `ERROR_DOCS + code`. */
export const ERROR_DOCS = 'https://joaogabriel15.github.io/vitral/erros/'

export class RemoteError extends Error {
  /** Link da página deste erro na documentação. */
  docs: string
  /** URL do JS do remote (ou a registrada, se o erro veio antes do manifesto). */
  entry?: string
  /** Versão do remote, do campo `version` do `vitral.json`. */
  version?: string
  /** `location.pathname` no momento do erro. */
  route?: string

  constructor(
    public code: RemoteErrorCode,
    public remote: string,
    message: string,
    public cause?: unknown,
  ) {
    super(`[vitral] ${remote}: ${message} (${ERROR_DOCS}${code})`)
    this.name = 'RemoteError'
    this.docs = `${ERROR_DOCS}${code}`
    if (typeof location != 'undefined') this.route = location.pathname
  }
}

/** `RemoteError` de qualquer cópia da lib (o `instanceof` falha entre cópias). */
export const isRemoteError = (e: unknown): e is RemoteError => (e as Error)?.name === 'RemoteError'

/** Arquivo e versão de cada remote montado agora (para atribuir erros sem tratamento). */
export const mounted = new Map<string, Pick<LoadedRemote, 'entry' | 'version'>>()

/** Erros (e as causas deles) já entregues ao `onError` do `configure`. */
export const reported = new WeakSet<object>()

/**
 * Completa a atribuição de `e` (`entry`, `version`) e entrega ao `onError`
 * do `configure`, uma vez só por erro. Devolve `e`, para `throw report(e)`.
 */
export function report<E>(e: E, from?: { entry?: string; version?: string }): E {
  if (isRemoteError(e) && !reported.has(e)) {
    reported.add(e)
    if (e.cause instanceof Object) reported.add(e.cause)
    e.entry ??= from?.entry ?? protocol().entry(e.remote)?.url
    e.version ??= from?.version
    try {
      protocol().settings().onError?.(e)
    } catch {}
  }
  return e
}

/** Para `.catch(fail)`: entrega o erro ao `onError` global e rejeita de novo. */
export const fail = (e: unknown): never => {
  throw report(e)
}
