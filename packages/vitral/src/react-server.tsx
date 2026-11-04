/**
 * SSR de um remote React, para o `render` do gateway (`vitral/edge`) ou do
 * host Next (`remoteProps` de `vitral/next-server`):
 *
 *   // carrinho/src/server.ts
 *   import { reactRender } from 'vitral/react-server'
 *   import Carrinho from './Carrinho'
 *   export const render = reactRender(Carrinho)
 *
 *   // com os dados buscados no servidor, sem buscar de novo no navegador:
 *   export const render = reactRender(Carrinho, { state: (props) => buscarItens(props.id) })
 *
 * No navegador, `reactRemote` (ou o plugin, que embrulha sozinho) hidrata
 * esse HTML, e `useInitialState()` devolve o mesmo estado dos dois lados. No
 * servidor, `useVitral()` devolve `null`.
 */
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import type { ServerRendered } from './core/ssr-markup'
import type { Props } from './core/types'
import { RemoteTree } from './react-tree'

export interface ReactRenderOptions<P> {
  /** Busca o estado inicial no servidor. Ele vai junto com o HTML e chega ao remote em `useInitialState()`. */
  state?: (props: P) => unknown
}

/** `render(props)` do servidor para um componente React. */
export function reactRender<P extends Props>(Component: ComponentType<P>): (props: P) => string
export function reactRender<P extends Props>(Component: ComponentType<P>, options: ReactRenderOptions<P>): (props: P) => Promise<ServerRendered>
export function reactRender<P extends Props>(Component: ComponentType<P>, options?: ReactRenderOptions<P>): (props: P) => ServerRendered | Promise<ServerRendered> {
  if (!options?.state) return (props) => renderToString(<RemoteTree Component={Component} props={props} ctx={null} />)
  const load = options.state
  return async (props) => {
    const state = await load(props)
    return { html: renderToString(<RemoteTree Component={Component} props={props} ctx={null} state={state} />), state }
  }
}
