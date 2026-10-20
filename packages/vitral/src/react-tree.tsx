/**
 * Árvore em volta do componente de um remote React. A mesma no cliente
 * (`vitral/react`) e no servidor (`vitral/react-server`): a hidratação e o
 * `useId` dependem de a árvore ser igual dos dois lados.
 */
import { Component as ReactComponent, createContext, type ComponentType, type ReactNode } from 'react'
import type { Props, RemoteContext } from './core/types'

export const VitralContext = createContext<RemoteContext | null>(null)

/** Erro de render dentro do remote vai para o host em vez de derrubar a página. */
class Boundary extends ReactComponent<{ ctx: RemoteContext | null; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    this.props.ctx?.reportError(error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function RemoteTree<P extends Props>({ Component, props, ctx }: { Component: ComponentType<P>; props: P; ctx: RemoteContext | null }) {
  return (
    <VitralContext.Provider value={ctx}>
      <Boundary ctx={ctx}>
        <Component {...props} />
      </Boundary>
    </VitralContext.Provider>
  )
}
