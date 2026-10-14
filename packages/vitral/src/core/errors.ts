export type RemoteErrorCode =
  | 'NOT_REGISTERED'
  | 'ORIGIN_BLOCKED'
  | 'TIMEOUT'
  | 'INTEGRITY'
  | 'INVALID_MODULE'
  | 'LOAD_FAILED'
  | 'MOUNT_FAILED'
  | 'RENDER_FAILED'
  | 'SHARED_READONLY'

/** Página de cada código de erro, com causa e correção. */
export const ERROR_DOCS = 'https://github.com/joaogabriel15/vitral/blob/main/docs/erros/'

export class RemoteError extends Error {
  /** Link da página deste erro na documentação. */
  docs: string

  constructor(
    public code: RemoteErrorCode,
    public remote: string,
    message: string,
    public cause?: unknown,
  ) {
    super(`[vitral] ${remote}: ${message} (${ERROR_DOCS}${code}.md)`)
    this.name = 'RemoteError'
    this.docs = `${ERROR_DOCS}${code}.md`
  }
}

/** `RemoteError` de qualquer cópia da lib (o `instanceof` falha entre cópias). */
export const isRemoteError = (e: unknown): e is RemoteError => (e as Error)?.name === 'RemoteError'
