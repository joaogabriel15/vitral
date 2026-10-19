import { isRemoteError, RemoteError } from './errors'
import { protocol } from './state'
import type { RemoteMetric } from './types'

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
      const retryable = isRemoteError(e) && (e.code === 'LOAD_FAILED' || e.code === 'TIMEOUT')
      if (!retryable || i >= retries) throw e
      await new Promise((r) => setTimeout(r, 200 * 2 ** i))
    }
  }
}

export function withTimeout<T>(ms: number, name: string, p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new RemoteError('TIMEOUT', name, `não respondeu em ${ms}ms`)), ms)
    p.then(resolve, reject).finally(() => clearTimeout(t))
  })
}

/** Baixa os bytes exatos do arquivo (base para conferir o SRI), corpo incluído no timeout. */
export function fetchBytes(url: string, timeout: number, name: string, init?: RequestInit): Promise<ArrayBuffer> {
  const ctrl = new AbortController()
  const got = fetch(url, { signal: ctrl.signal, credentials: 'omit', ...init }).then(
    (res) => {
      if (!res.ok) throw new RemoteError('LOAD_FAILED', name, `HTTP ${res.status} em ${url}`)
      return res.arrayBuffer()
    },
    (e) => {
      throw new RemoteError('LOAD_FAILED', name, `falha ao baixar ${url}`, e)
    },
  )
  return withTimeout(timeout, name, got).catch((e) => {
    ctrl.abort()
    throw e
  })
}

export async function fetchJson<T>(url: string, timeout: number, name: string, init?: RequestInit): Promise<T> {
  const text = new TextDecoder().decode(await fetchBytes(url, timeout, name, init))
  try {
    return JSON.parse(text) as T
  } catch (e) {
    throw new RemoteError('INVALID_MODULE', name, `JSON inválido em ${url}`, e)
  }
}

/** Adiciona um `<link>` com CORS anônimo (o mesmo modo dos downloads da lib). */
export function addLink(rel: string, href: string, props: Partial<HTMLLinkElement> = {}, parent: Node = document.head): HTMLLinkElement {
  return parent.appendChild(Object.assign(document.createElement('link'), { rel, crossOrigin: 'anonymous', href }, props))
}

/** Marca o fim de uma etapa que começou em `start` (performance.now()). */
export function metric(name: string, stage: RemoteMetric['stage'], start: number): void {
  try {
    // Uma entrada por remote e etapa: sem isso, cada montagem soma uma na
    // timeline da página, para sempre.
    const label = `vitral:${name}:${stage}`
    performance.clearMeasures(label)
    performance.measure(label, { start })
    protocol().settings().onMetric?.({ name, stage, start, duration: performance.now() - start })
  } catch {}
}
