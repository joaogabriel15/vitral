/**
 * Portais de um remote com CSS escopado. Um `createPortal` para o
 * `document.body` (dialogs e popovers do Radix, por exemplo) fica fora do
 * elemento do remote e perderia o CSS dele. Cada elemento novo no `body` que
 * o React do remote renderizou ganha o `data-vitral-scope` do remote, e o CSS
 * escopado vale lá também. Quem criou o elemento sai da árvore do React
 * (`__reactFiber$…`): a biblioteca de UI não precisa mudar.
 */
export function scopePortals(root: Element, scope: string): () => void {
  const owner = (node: Element): boolean => {
    const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'))
    for (let f = key && (node as any)[key]; f; f = f.return) {
      const s = f.stateNode
      // Um elemento do remote acima do portal, ou a raiz do React montada no remote.
      if (s && s !== node && s.nodeType === 1 && root.contains(s)) return true
      if (f.tag === 3) return s?.containerInfo === root
    }
    return false
  }
  const mark = (n: Node) => {
    if (n instanceof Element && !n.hasAttribute('data-vitral-scope') && owner(n)) n.setAttribute('data-vitral-scope', scope)
  }
  // O callback roda antes da pintura: o portal já aparece com o estilo.
  const watch = new MutationObserver((list) => list.forEach((r) => r.addedNodes.forEach(mark)))
  watch.observe(document.body, { childList: true })
  // Portais abertos antes de este módulo chegar.
  document.body.childNodes.forEach(mark)
  return () => watch.disconnect()
}
