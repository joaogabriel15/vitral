/**
 * Vários componentes e módulos por remote.
 *
 * O arquivo do remote pode exportar, além do `default`, um mapa `exposes`:
 *
 *   export default reactRemote(Carrinho)
 *   export const exposes = {
 *     './MiniCarrinho': () => import('./MiniCarrinho'),
 *     './api': () => import('./api'),
 *   }
 *
 * O host pede `carrinho/MiniCarrinho` (componente) ou `loadModule('carrinho/api')`
 * (qualquer módulo). Tudo vem do mesmo arquivo, com o mesmo SRI e a mesma
 * allowlist, e as partes dividem as mesmas instâncias de módulo.
 */
import { RemoteError } from './errors'
import { mountable } from './loader'
import { protocol, type LoadedRemote } from './state'

type LoadFile = (name: string) => Promise<LoadedRemote>

/**
 * Divide `carrinho/MiniCarrinho` em remote registrado e chave (`./MiniCarrinho`).
 * Vale o maior prefixo registrado, então nomes com `/` (`@loja/carrinho`) funcionam.
 */
export function splitName(name: string): [remote: string, key: string | null] {
  const p = protocol()
  let i = name.length
  if (!p.entry(name)) while ((i = name.lastIndexOf('/', i - 1)) > 0 && !p.entry(name.slice(0, i)));
  return i > 0 && i < name.length ? [name.slice(0, i), '.' + name.slice(i)] : [name, null]
}

/** Carrega um nome qualquer e devolve o que dá para montar (com `mount`). */
export function resolveTarget(name: string, loadFile: LoadFile): Promise<LoadedRemote> {
  return resolveAny(name, loadFile).then((r) => mountable(name, r))
}

function resolveAny(name: string, loadFile: LoadFile): Promise<LoadedRemote> {
  const p = protocol()
  // Caminho rápido: nome registrado ou sem `/` não depende de registros pendentes.
  if (p.entry(name) || !name.includes('/')) return loadFile(name)
  return p.pending().then(async () => {
    const [remote, key] = splitName(name)
    if (!key) return loadFile(name)
    const r = await loadFile(remote)
    // Chaves começam com `./`, então nunca batem com nomes do Object.prototype.
    const table = r.exports?.exposes as Record<string, unknown> | undefined
    if (!table?.[key]) throw new RemoteError('NOT_EXPOSED', name, `${remote} não expõe ${key}. Expostos: ${Object.keys(table ?? {}).join(', ')}`)
    try {
      const value = table[key]
      // `() => import()` devolve sempre o mesmo namespace: o cache é do próprio navegador.
      const ns: any = await (typeof value == 'function' ? value() : value)
      return { ...r, module: ns?.default ?? ns, exports: ns }
    } catch (e) {
      throw new RemoteError('LOAD_FAILED', name, String(e), e)
    }
  })
}

/** Namespace ES de um remote ou de uma parte dele (base de `loadModule`). */
export async function resolveModule<T>(name: string, loadFile: LoadFile): Promise<T> {
  const r = await resolveAny(name, loadFile)
  if (!r.exports) {
    throw new RemoteError('INVALID_MODULE', name, 'o remote foi carregado por uma cópia antiga da lib, que não guarda os exports')
  }
  return r.exports as T
}
