# Preact

Preact 10 ou mais novo. Import: `vitral/preact`.

## Hoje e com vitral

Exemplo: uma loja em Preact mostra o carrinho, feito por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem.

### Hoje, com Module Federation

O Module Federation não tem adaptador para Preact, então o carrinho expõe uma função que monta o componente.

```jsx
// carrinho/src/Carrinho.jsx
export default function Carrinho({ userId }) {
  return <p>Carrinho do usuário {userId}</p>
}
```

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
import preact from '@preact/preset-vite'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    preact(),
    federation({
      name: 'carrinho',
      filename: 'remoteEntry.js',
      exposes: { './montar': './src/montar.jsx' },
      shared: { 'preact': { singleton: true } },
    }),
  ],
}
```

```js
// loja/vite.config.js
import preact from '@preact/preset-vite'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    preact(),
    federation({
      name: 'loja',
      remotes: {
        carrinho: { type: 'module', name: 'carrinho', entry: 'https://cdn.empresa.com/carrinho/remoteEntry.js' },
      },
      shared: { 'preact': { singleton: true } },
    }),
  ],
}
```

```jsx
// loja/src/Pagina.jsx
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
// carrinho/src/Carrinho.jsx (igual)
export default function Carrinho({ userId }) {
  return <p>Carrinho do usuário {userId}</p>
}
```

```jsx
// carrinho/src/montar.jsx (não precisa mais: o plugin monta o componente)
```

```js
// carrinho/vite.config.js (vitral no lugar do federation)
import preact from '@preact/preset-vite'
import vitral from 'vitral/vite'

export default {
  plugins: [
    preact(),
    vitral({ name: 'carrinho', entry: 'src/Carrinho.jsx' }),
  ],
}
```

```js
// loja/vite.config.js (sem o federation)
import preact from '@preact/preset-vite'

export default {
  plugins: [preact()],
}
```

```jsx
// loja/src/Pagina.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/preact'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function Pagina() {
  return <Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
}
```

Mudar `props` atualiza o carrinho sem remontar. Carregando e erro em [Host](#host).

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

Sem `error`, aparece "Não foi possível carregar." com o botão "Tentar de novo". `error={null}` não mostra nada.

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
