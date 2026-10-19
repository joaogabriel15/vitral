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

Um remote com `mount`.

## Observações

- Com o plugin `vitral/vite`, o `export default` do componente já basta. O plugin chama `reactRemote`.
- Erros de render vão para o `error` do host.
- Para ler o `ctx`, use [`useVitral`](./hooks#usevitral).
