# reactRemote

Transforma um componente React em um remote.

```ts
reactRemote<P>(Component: ComponentType<P>): RemoteModule<P>
```

## Uso

```jsx
import { reactRemote } from 'vitral/react'
import Carrinho from './Carrinho'

export default reactRemote(Carrinho)
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `Component` | Componente que recebe as props do host |

## Retorno

Um remote com `mount` e `hydrate`. `hydrate` assume o HTML que [`reactRender`](#reactrender) gerou no servidor (com `hydrateRoot`), sem recriar o DOM.

## Observações

- Com o plugin `vitral/vite`, o `export default` do componente já basta. O plugin chama `reactRemote`.
- Erros de render vão para o `error` do host.
- Para ler o `ctx`, use [`useVitral`](./hooks#usevitral).

## reactRender

`render` do remote para o SSR do gateway (`vitral/edge`). Roda no servidor.

```ts
import { reactRender } from 'vitral/react-server'

reactRender<P>(Component: ComponentType<P>): (props: P) => string
```

```ts
// carrinho/src/server.ts
import { reactRender } from 'vitral/react-server'
import Carrinho from './Carrinho'

export const render = reactRender(Carrinho)
```

- A árvore em volta do componente é a mesma de `reactRemote`, então `hydrate` não acusa diferença, nem com `useId`.
- No servidor, [`useVitral`](./hooks#usevitral) devolve `null`.
- Veja [Rotas com SSR](/aprender/ssr#rotas-com-ssr).
