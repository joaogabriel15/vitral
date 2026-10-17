# Preact

Preact 10 ou mais novo. Import: `vitral/preact`.

## Host

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/preact'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function App() {
  return (
    <Remote
      name="carrinho"
      props={{ userId: 42 }}
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
import { preactRemote } from 'vitral/preact'

function Carrinho({ userId, vitral }) {
  return <button onClick={() => vitral.events.emit('carrinho:abrir')}>Carrinho de {userId}</button>
}

export default preactRemote(Carrinho)
```

```js
// vite.config.js
import preact from '@preact/preset-vite'
import vitral from 'vitral/vite'

export default { plugins: [preact(), vitral({ entry: 'src/remote.jsx' })] }
```

O `ctx` chega na prop `vitral`.

## Estado compartilhado

```jsx
import { useShared } from 'vitral/preact'

const nome = useShared('usuario', (u) => u?.nome)
```

Veja [Contexto compartilhado](/aprender/contexto).
