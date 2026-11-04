# Solid

Solid 1.8 ou mais novo. Import: `vitral/solid`.

## Hoje e com vitral

Exemplo: uma loja em Solid que mostra o carrinho de outra equipe.

### Hoje, com Module Federation

O Module Federation não tem adaptador para Solid. O carrinho expõe uma função que monta o componente, e a loja chama essa função.

```jsx
// carrinho/src/montar.jsx
import { render } from 'solid-js/web'
import Carrinho from './Carrinho'

export function montar(el, props) {
  return render(() => <Carrinho {...props} />, el) // devolve a função que desmonta
}
```

```js
// carrinho/vite.config.js
federation({
  name: 'carrinho',
  filename: 'remoteEntry.js',
  exposes: { './montar': './src/montar.jsx' },
  shared: { 'solid-js': { singleton: true } },
})
```

```jsx
// loja/src/Pagina.jsx (a loja também tem o federation() com remotes)
import { onCleanup, onMount } from 'solid-js'

function Pagina() {
  let el
  onMount(async () => {
    const { montar } = await import('carrinho/montar')
    onCleanup(montar(el, { userId: 42 }))
  })
  return <div ref={el} />
}
```

### Com vitral

```jsx
// carrinho/src/remote.jsx (no lugar do montar.jsx)
import { solidRemote } from 'vitral/solid'
import Carrinho from './Carrinho'

export default solidRemote(Carrinho)
```

```js
// carrinho/vite.config.js (sem federation)
import solid from 'vite-plugin-solid'
import vitral from 'vitral/vite'

export default { plugins: [solid(), vitral({ entry: 'src/remote.jsx' })] }
```

```jsx
// loja/src/Pagina.jsx (sem plugin no build da loja)
import { configure } from 'vitral'
import { Remote } from 'vitral/solid'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

function Pagina() {
  return <Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
}
```

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
