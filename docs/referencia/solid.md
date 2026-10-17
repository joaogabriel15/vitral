# vitral/solid

Host e remote em Solid 1.8 ou mais novo.

```ts
import { Remote, solidRemote, useShared } from 'vitral/solid'
```

## &lt;Remote&gt;

```jsx
<Remote
  name="carrinho"
  props={{ userId: userId() }}
  fallback={<p>Carregando…</p>}
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
/>
```

As props são as mesmas do [`<Remote>` do React](/referencia/react/remote#props), com `class` em vez de `className` e sem `onError`. No servidor (SolidStart), renderiza só o `fallback`.

## solidRemote

```ts
solidRemote<P>(Comp: Component): RemoteModule<P>
```

```jsx
function Carrinho(props) {
  return <button onClick={() => props.vitral.events.emit('carrinho:abrir')}>Carrinho de {props.userId}</button>
}

export default solidRemote(Carrinho)
```

O `ctx` chega na prop `vitral`.

## useShared

```ts
useShared<T, S>(key: string, select?: (value: T | undefined) => S): Accessor<S>
```

```jsx
const nome = useShared('usuario', (u) => u?.nome)
return <p>{nome()}</p>
```
