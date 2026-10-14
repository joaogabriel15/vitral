import { RemoteError } from './errors'

export function pageOrigin(): string | null {
  return typeof location !== 'undefined' ? location.origin : null
}

export function absolute(url: string, base?: string): string {
  return new URL(url, base ?? (typeof location !== 'undefined' ? location.href : undefined)).href
}

export async function withRetry<T>(retries: number, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      const retryable = e instanceof RemoteError && (e.code === 'LOAD_FAILED' || e.code === 'TIMEOUT')
      if (!retryable || i >= retries) throw e
      await new Promise((r) => setTimeout(r, 200 * 2 ** i))
    }
  }
}

export function withTimeout<T>(ms: number, name: string, p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new RemoteError('TIMEOUT', name, `não respondeu em ${ms}ms`)), ms)
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    )
  })
}

/** Baixa os bytes exatos do arquivo (base para conferir o SRI), corpo incluído no timeout. */
export async function fetchBytes(url: string, timeout: number, name: string, cache?: RequestCache): Promise<ArrayBuffer> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', cache })
    if (!res.ok) throw new RemoteError('LOAD_FAILED', name, `HTTP ${res.status} em ${url}`)
    return await res.arrayBuffer()
  } catch (e) {
    if (e instanceof RemoteError) throw e
    if (ctrl.signal.aborted) throw new RemoteError('TIMEOUT', name, `não respondeu em ${timeout}ms`)
    throw new RemoteError('LOAD_FAILED', name, `falha ao baixar ${url}`, e)
  } finally {
    clearTimeout(t)
  }
}

export async function fetchJson<T>(url: string, timeout: number, name: string, cache?: RequestCache): Promise<T> {
  const text = new TextDecoder().decode(await fetchBytes(url, timeout, name, cache))
  try {
    return JSON.parse(text) as T
  } catch (e) {
    throw new RemoteError('INVALID_MODULE', name, `JSON inválido em ${url}`, e)
  }
}
