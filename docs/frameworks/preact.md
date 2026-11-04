# Preact

Preact 10 ou mais novo. Import: `vitral/preact`.

## Hoje e com vitral

Exemplo: uma loja em Preact que mostra o carrinho de outra equipe.

### Hoje, com Module Federation

O Module Federation não tem adaptador para Preact. O carrinho expõe uma função que monta o componente, e a loja chama essa função.

```jsx
// carrinho/src/montar.jsx
import { render } from 'preact'
import Carrinho from './Carrinho'

export function montar(el, props) {
  render(<Carrinho {...props} />, el)
  return () => render(null, el)
}
```

```js
// carrinho/vite.config.js
federation({
  name: 'carrinho',
  filename: 'remoteEntry.js',
  exposes: { './montar': './src/montar.jsx' },
  shared: { preact: { singleton: true } },
})
```

```jsx
// loja/src/Pagina.jsx (a loja também tem o federation() com remotes)
import { useEffect, useRef } from 'preact/hooks'

export function Pagina() {
  const el = useRef(null)
  useEffect(() => {
    let desmontar
    import('carrinho/montar').then(({ montar }) => (desmontar = montar(el.current, { userId: 42 })))
    return () => desmontar?.()
  }, [])
  return <div ref={el} />
}
```

### Com vitral

```jsx
// carrinho/src/remote.jsx (no lugar do montar.jsx)
import { preactRemote } from 'vitral/preact'
import Carrinho from './Carrinho'

export default preactRemote(Carrinho)
```

```js
// carrinho/vite.config.js (sem federation)
import preact from '@preact/preset-vite'
import vitral from 'vitral/vite'

export default { plugins: [preact(), vitral({ entry: 'src/remote.jsx' })] }
```

```jsx
// loja/src/Pagina.jsx (sem plugin no build da loja)
import { configure } from 'vitral'
import { Remote } from 'vitral/preact'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function Pagina() {
  return <Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
}
```

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
