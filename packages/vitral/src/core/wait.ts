/** `waitFor` dos componentes de host: espera chaves do contexto compartilhado. */
const noop = () => {}

/**
 * Chama `fn` quando todas as chaves de `keys` do contexto compartilhado
 * tiverem valor. Devolve a função que cancela. O store só baixa para quem usa.
 */
export function whenShared(keys: string[], fn: () => void): () => void {
  if (!keys.length) return (fn(), noop)
  let offs: (() => void)[] = []
  let done = false
  const stop = () => {
    done = true
    for (const off of offs) off()
    offs = []
  }
  import('./shared').then(({ shared }) => {
    if (done) return
    const check = () => {
      if (!done && keys.every((k) => shared(k).get() != null)) (stop(), fn())
    }
    // `subscribe` chama na hora: a lista de cancelamentos vem antes de conferir.
    offs = keys.map((k) => shared(k).subscribe(() => queueMicrotask(check)))
  })
  return stop
}
