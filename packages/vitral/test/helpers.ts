import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { vi } from 'vitest'
import { __reset, configure } from '../src/index'

/** Espera promessas e microtasks pendentes (montagem é assíncrona). */
export const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

export function cleanup() {
  document.body.replaceChildren()
  __reset()
  vi.unstubAllGlobals()
}

/** Remote em disco (`ctx.name:props.n`): o Node importa file:, com URL hierárquica para ctx.baseUrl. */
export const FIXTURE_REMOTE = pathToFileURL(resolve(__dirname, 'fixtures/remote-src.mjs')).href

/**
 * Responde a qualquer manifesto com `{ name, entry }`, para testar `src` sem
 * rede. Libera todas as origens, porque o fixture vem de `file:`.
 */
export function serveManifest(name: string | ((url: string) => string) = 'carrinho', entry = FIXTURE_REMOTE) {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify({ name: typeof name === 'function' ? name(url) : name, entry })))
  vi.stubGlobal('fetch', fetch)
  configure({ allowedOrigins: ['*'] })
  return fetch
}
