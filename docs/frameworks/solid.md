# Solid

Solid 1.8 ou mais novo. Import: `vitral/solid`.

## Host

```jsx
import { createSignal } from 'solid-js'
import { configure } from 'vitral'
import { Remote } from 'vitral/solid'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

function App() {
  const [userId] = createSignal(42)
  return (
    <Remote
      name="carrinho"
      props={{ userId: userId() }}
      fallback={<p>Carregando…</p>}
      error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
    />
  )
}
```

As props de `<Remote>` são as mesmas do [React](./react#host).

## Remote

```jsx
// src/remote.jsx
import { solidRemote } from 'vitral/solid'

function Carrinho(props) {
  return <button onClick={() => props.vitral.events.emit('carrinho:abrir')}>Carrinho de {props.userId}</button>
}

export default solidRemote(Carrinho)
```

```js
// vite.config.js
import solid from 'vite-plugin-solid'
import vitral from 'vitral/vite'

export default { plugins: [solid(), vitral({ entry: 'src/remote.jsx' })] }
```

O `ctx` chega na prop `vitral`.

## Estado compartilhado

```jsx
import { useShared } from 'vitral/solid'

const nome = useShared('usuario', (u) => u?.nome) // accessor
return <p>{nome()}</p>
```

Veja [Contexto compartilhado](/aprender/contexto).
