/**
 * SSR de um remote React, para o `render` do gateway (`vitral/edge`):
 *
 *   // carrinho/src/server.ts
 *   import { reactRender } from 'vitral/react-server'
 *   import Carrinho from './Carrinho'
 *   export const render = reactRender(Carrinho)
 *
 * No navegador, `reactRemote` (ou o plugin, que embrulha sozinho) hidrata
 * esse HTML. No servidor, `useVitral()` devolve `null`.
 */
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import type { Props } from './core/types'
import { RemoteTree } from './react-tree'

/** `render(props)` do gateway para um componente React. */
export function reactRender<P extends Props>(Component: ComponentType<P>): (props: P) => string {
  return (props) => renderToString(<RemoteTree Component={Component} props={props} ctx={null} />)
}
