/** `waitFor` dos componentes de host: espera chaves do contexto compartilhado. */
import { protocol } from './state'

declare const __VITRAL_EMBED__: true | undefined

const noop = () => {}

/**
 * Chama `fn` quando todas as chaves de `keys` do contexto compartilhado
 * tiverem valor (nem `undefined` nem `null`). Devolve a função que cancela.
 * Usa o store da página pelo protocolo: nada do código do store entra aqui.
 */
export function whenShared(keys: string[], fn: () => void): () => void {
  // O embed (widget em site de terceiros) não tem o store do host.
  if (!keys.length || typeof __VITRAL_EMBED__ !== 'undefined') return (fn(), noop)
  let offs: (() => void)[] = []
  let done = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    done = true
    clearTimeout(timer)
    for (const off of offs) off()
    offs = []
  }
  const go = () => {
    if (done) return
    const store = protocol().shared?.()
    // Sem store, ninguém deu `provide` ainda: confere de novo daqui a pouco.
    if (!store) return void (timer = setTimeout(go, 50))
    const check = () => !done && keys.every((k) => store.get(k) != null) && (stop(), fn())
    offs = keys.map((k) => store.subscribe(k, check))
    check()
  }
  go()
  return stop
}
