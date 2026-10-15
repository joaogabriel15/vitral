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

/** Endereço das páginas de erro no site. A página de cada código é `ERROR_DOCS + code`. */
export const ERROR_DOCS = 'https://joaogabriel15.github.io/vitral/erros/'

export class RemoteError extends Error {
  /** Link da página deste erro na documentação. */
  docs: string

  constructor(
    public code: RemoteErrorCode,
    public remote: string,
    message: string,
    public cause?: unknown,
  ) {
    super(`[vitral] ${remote}: ${message} (${ERROR_DOCS}${code})`)
    this.name = 'RemoteError'
    this.docs = `${ERROR_DOCS}${code}`
  }
}

/** `RemoteError` de qualquer cópia da lib (o `instanceof` falha entre cópias). */
export const isRemoteError = (e: unknown): e is RemoteError => (e as Error)?.name === 'RemoteError'
