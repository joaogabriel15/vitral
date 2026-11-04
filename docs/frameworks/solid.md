# Solid

Solid 1.8 ou mais novo. Import: `vitral/solid`.

## Hoje e com vitral

Exemplo: uma loja em Solid mostra o carrinho, feito por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem.

### Hoje, com Module Federation

O Module Federation não tem adaptador para Solid, então o carrinho expõe uma função que monta o componente.

```jsx
// carrinho/src/Carrinho.jsx
export default function Carrinho(props) {
  return <p>Carrinho do usuário {props.userId}</p>
}
```

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
import solid from 'vite-plugin-solid'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    solid(),
    federation({
      name: 'carrinho',
      filename: 'remoteEntry.js',
      exposes: { './montar': './src/montar.jsx' },
      shared: { 'solid-js': { singleton: true } },
    }),
  ],
}
```

```js
// loja/vite.config.js
import solid from 'vite-plugin-solid'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    solid(),
    federation({
      name: 'loja',
      remotes: {
        carrinho: { type: 'module', name: 'carrinho', entry: 'https://cdn.empresa.com/carrinho/remoteEntry.js' },
      },
      shared: { 'solid-js': { singleton: true } },
    }),
  ],
}
```

```jsx
// loja/src/Pagina.jsx
import { onCleanup, onMount } from 'solid-js'

export function Pagina() {
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
// carrinho/src/Carrinho.jsx (igual)
export default function Carrinho(props) {
  return <p>Carrinho do usuário {props.userId}</p>
}
```

```jsx
// carrinho/src/montar.jsx (não precisa mais: o plugin monta o componente)
```

```js
// carrinho/vite.config.js (vitral no lugar do federation)
import solid from 'vite-plugin-solid'
import vitral from 'vitral/vite'

export default {
  plugins: [
    solid(),
    vitral({ name: 'carrinho', entry: 'src/Carrinho.jsx' }),
  ],
}
```

```js
// loja/vite.config.js (sem o federation)
import solid from 'vite-plugin-solid'

export default {
  plugins: [solid()],
}
```

```jsx
// loja/src/Pagina.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/solid'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function Pagina() {
  return <Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
}
```

Mudar `props` atualiza o carrinho sem remontar. Carregando e erro em [Host](#host).

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
