# vitral/preact

Host e remote em Preact 10 ou mais novo.

```ts
import { Remote, preactRemote, useShared } from 'vitral/preact'
```

## &lt;Remote&gt;

```jsx
<Remote
  name="carrinho"
  props={{ userId: 42 }}
  fallback={<p>Carregando…</p>}
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
/>
```

As props são as mesmas do [`<Remote>` do React](/referencia/react/remote#props), sem `onError` e `className`. Atributos extras vão para o elemento.

## preactRemote

```ts
preactRemote<P>(Component: ComponentType): RemoteModule<P>
```

```jsx
import { preactRemote } from 'vitral/preact'

export default preactRemote(Carrinho)
```

## useShared

```ts
useShared<T, S>(key: string, select?: (value: T | undefined) => S): S
```

Igual ao [`useShared` do React](/referencia/react/hooks#useshared).
