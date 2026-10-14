/**
 * Extras opcionais do contexto compartilhado: guardar no storage, espelhar
 * entre abas e levar os valores do SSR para o cliente. Ficam fora do store
 * para só entrar no bundle de quem usa.
 */
import type { SharedValue } from './shared'

export interface PersistOptions {
  /** `'local'` (padrão) ou `'session'`. */
  storage?: 'local' | 'session'
  /**
   * Versão do formato do valor. Faz parte da chave do storage
   * (`vitral:<chave>:<versão>`): ao mudar o formato, suba a versão e o valor
   * antigo é ignorado. Padrão `1`.
   */
  version?: string | number
}

/**
 * Restaura o valor guardado (se houver) e guarda cada mudança. Valores que
 * não viram JSON (funções, por exemplo) não são guardados. Sem storage
 * (servidor, modo privado bloqueado), não faz nada.
 *
 *   const carrinho = persist(provide('carrinho', []), { version: 2 })
 */
export function persist<V extends SharedValue<any>>(value: V, options: PersistOptions = {}): V {
  const key = `vitral:${value.key}:${options.version ?? 1}`
  let storage: Storage
  try {
    storage = options.storage === 'session' ? sessionStorage : localStorage
    const saved = storage.getItem(key)
    if (saved !== null) value.set(JSON.parse(saved))
  } catch {
    return value
  }
  value.subscribe((v) => {
    try {
      storage.setItem(key, JSON.stringify(v))
    } catch (e) {
      console.warn(`[vitral] não foi possível guardar "${value.key}"`, e)
    }
  })
  return value
}

/**
 * Espelha as mudanças entre abas da mesma origem (`BroadcastChannel`). Chame
 * nas duas abas, de preferência no dono da chave: assim a mudança que chega
 * passa mesmo com `writable: false`. Só dados que o `structuredClone` aceita
 * atravessam. Junto com `persist`, uma aba nova começa com o último valor.
 *
 *   const carrinho = syncTabs(persist(provide('carrinho', [])))
 */
export function syncTabs<V extends SharedValue<any>>(value: V): V {
  if (typeof BroadcastChannel === 'undefined') return value
  const channel = new BroadcastChannel(`vitral:${value.key}`)
  let receiving = false
  let first = true
  channel.onmessage = (e) => {
    receiving = true
    try {
      value.set(e.data)
    } finally {
      receiving = false
    }
  }
  value.subscribe((v) => {
    // A primeira chamada é o valor atual desta aba: não sobrescreve as outras.
    if (first) return void (first = false)
    if (receiving) return
    try {
      channel.postMessage(v)
    } catch (e) {
      console.warn(`[vitral] "${value.key}" não pode ser enviado a outras abas`, e)
    }
  })
  return value
}

/**
 * SSR: transforma os valores de uma requisição no conteúdo do
 * `<script type="application/json" data-vitral-shared>`, que o store do
 * cliente lê antes dos remotes montarem. Funções e `undefined` ficam de fora;
 * `<` é escapado para o JSON não fechar o `<script>`.
 *
 *   `<script type="application/json" data-vitral-shared>${serializeShared({ usuario })}</script>`
 */
export function serializeShared(values: Record<string, unknown>): string {
  return JSON.stringify(values).replace(/</g, '\\u003c')
}
