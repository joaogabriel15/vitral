# Início rápido

Esta página mostra o vitral inteiro em poucos minutos. As próximas páginas explicam cada parte.

## O que você vai aprender

- O que é um remote e o que é um host
- Como publicar um remote
- Como mostrar um remote no host
- Como passar props e ouvir eventos

## Remote e host

Um **remote** é um componente publicado num CDN. O **host** é a página que mostra os remotes. O host só precisa da URL do `vitral.json` de cada remote.

```
host (React)              remote (Vue)
configure({ remotes })    vite build → dist/vitral.json
<Remote name="carrinho">  ← baixa e monta o remote
```

Exemplo: uma loja em React mostra o carrinho, feito por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem.

## Hoje, com Module Federation

```jsx
// carrinho/src/Carrinho.jsx
export default function Carrinho({ userId }) {
  return <p>Carrinho do usuário {userId}</p>
}
```

```js
// carrinho/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'carrinho',
      filename: 'remoteEntry.js',
      exposes: { './Carrinho': './src/Carrinho.jsx' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
}
```

```js
// loja/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'loja',
      remotes: { carrinho: 'carrinho@https://cdn.empresa.com/carrinho/remoteEntry.js' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
}
```

```jsx
// loja/src/App.jsx
import { lazy, Suspense } from 'react'

const Carrinho = lazy(() => import('carrinho/Carrinho'))

export function App() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Carrinho userId={42} />
    </Suspense>
  )
}
```

## O mesmo app com vitral

```jsx
// carrinho/src/Carrinho.jsx (igual)
export default function Carrinho({ userId }) {
  return <p>Carrinho do usuário {userId}</p>
}
```

```js
// carrinho/vite.config.js (no lugar do webpack.config.js)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [
    react(),
    vitral({ name: 'carrinho', entry: 'src/Carrinho.jsx', dedupe: ['react'] }),
  ],
}
```

```js
// loja/webpack.config.js (sem o ModuleFederationPlugin)
module.exports = {
  plugins: [],
}
```

```jsx
// loja/src/App.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function App() {
  return <Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
}
```

`vite build` no carrinho gera o JS, o CSS e o `vitral.json`. Mudar `props` atualiza o carrinho sem remontar.

O carrinho não precisa ser React: com `vue()` no lugar de `react()` e um `Carrinho.vue`, a loja continua igual.

## Sem build no host

Numa página HTML qualquer:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json"></vitral-remote>
```

## O contrato

Todo remote, em qualquer framework, é um módulo com `mount`:

```ts
export default {
  mount(el, props, ctx) {
    el.textContent = `Olá, ${props.nome}`
    return {
      update(next) { el.textContent = `Olá, ${next.nome}` },
      unmount() { el.textContent = '' },
    }
  },
}
```

Os adaptadores de cada framework geram esse objeto para você.
