/**
 * `exposes` no plugin Vite: gera uma entrada virtual que reexporta o remote e
 * acrescenta o mapa `exposes`, com um `import()` por parte.
 *
 *   vitral({ entry: 'src/remote.tsx', exposes: { './MiniCarrinho': 'src/MiniCarrinho.tsx', './api': 'src/api.ts' } })
 *
 * No build de arquivo único, os `import()` entram no mesmo arquivo: um hash
 * SRI cobre tudo, e as partes dividem as mesmas instâncias de módulo.
 */
import { resolve } from 'node:path'

/** Nome do arquivo virtual usado como `build.lib.entry`. */
export const EXPOSES_ENTRY = '__vitral_exposes__.js'
const ID = '\0vitral-exposes'

/** `MiniCarrinho` e `./MiniCarrinho` viram `./MiniCarrinho`. */
export function exposeKeys(exposes: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, file] of Object.entries(exposes)) {
    const clean = key.replace(/^\.?\/?/, '')
    if (!clean) throw new Error(`[vitral] exposes: chave inválida "${key}". Use algo como "./MiniCarrinho".`)
    out['./' + clean] = file
  }
  return out
}

/** Ids que `resolveExposesId` trata, para o filtro do hook. */
export const EXPOSES_IDS = /(^|[\\/])__vitral_exposes__\.js$/

export function resolveExposesId(id: string): string | null {
  return id === EXPOSES_ENTRY || id.endsWith('/' + EXPOSES_ENTRY) || id.endsWith('\\' + EXPOSES_ENTRY) ? ID : null
}

/** Código da entrada virtual, ou `null` se `id` não é ela. */
export function loadExposes(id: string, root: string, entry: string, exposes: Record<string, string>, main?: string): string | null {
  if (id !== ID) return null
  const file = (f: string) => JSON.stringify(resolve(root, f).replace(/\\/g, '/'))
  const parts = Object.entries(exposeKeys(exposes)).map(([key, f]) => `  ${JSON.stringify(key)}: () => import(${file(f)}),`)
  // `main`: a entrada embrulhada pelo adaptador, quando há uma.
  return [`export * from ${file(entry)}`, `export { default } from ${main ? JSON.stringify(main) : file(entry)}`, `export const exposes = {`, ...parts, `}`, ''].join('\n')
}
