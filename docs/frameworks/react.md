# React

React 18 e 19. Import: `vitral/react`.

## Hoje e com vitral

Exemplo: uma loja em React mostra o carrinho, feito por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem.

### Hoje, com Module Federation

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

### Com vitral

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

Guia completo: [Migrar do Module Federation](/migracao/module-federation).

## Host

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function App() {
  const [userId, setUserId] = useState(42)
  return (
    <Remote
      name="carrinho"
      props={{ userId, aoFinalizar: (pedido) => console.log(pedido) }}
      fallback={<p>Carregando…</p>}
      error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
      onError={(erro) => console.error(erro.code)}
    />
  )
}
```

Mudar `props` atualiza o remote. Mudar `name`, `src` ou `isolate` remonta.

| Prop | Tipo | O que faz |
| --- | --- | --- |
| `name` | `string` | Nome registrado em `configure` |
| `src` | `string` | URL do `vitral.json`. Dispensa `configure` |
| `props` | `object` | Props do remote. Funções também passam |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolamento. Veja [Estilos](/aprender/estilos) e [Iframe](/aprender/iframe) |
| `fallback` | `ReactNode` | Mostrado enquanto carrega |
| `error` | `ReactNode` ou `(erro, tentarDeNovo) => ReactNode` | Mostrado se falhar. Sem ela, "Não foi possível carregar." com o botão "Tentar de novo". `null` não mostra nada |
| `onError` | `(erro) => void` | Chamado em cada erro |
| `className` | `string` | Classe do elemento que recebe o remote |
| `loading` | `'lazy' \| 'idle'` | Quando montar. Veja [Carregamento](/aprender/carregamento) |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Baixar antes de montar |
| `priority` | `'high'` | Prioridade alta nos downloads |
| `keepAlive` | `boolean \| number` | Guarda o remote montado ao sair da página |

## Remote

Com o plugin, basta o `export default`:

```jsx
// src/App.jsx
export default function Carrinho({ userId }) {
  return <p>Carrinho de {userId}</p>
}
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

Ou use o adaptador explícito:

```jsx
import { reactRemote } from 'vitral/react'
import Carrinho from './Carrinho'

export default reactRemote(Carrinho)
```

Erros de render vão para o `error` do host.

## Contexto, eventos e estado no remote

```jsx
import { useVitral, useEvent, useEventValue, useShared } from 'vitral/react'

function Carrinho() {
  const ctx = useVitral()                         // contexto do remote, ou null fora dele
  const total = useEventValue('carrinho:total')   // último valor emitido
  useEvent('carrinho:limpo', () => alert('Vazio'))
  const nome = useShared('usuario', (u) => u?.nome)
  return <button onClick={() => ctx?.navigate('/checkout')}>{nome}: {total}</button>
}
```

| Hook | O que faz |
| --- | --- |
| `useVitral()` | Devolve o `ctx` do remote |
| `useEvent(tipo, fn)` | Assina um evento enquanto o componente existe |
| `useEventValue(tipo)` | Último valor de um evento. Re-renderiza a cada `emit` |
| `useShared(chave, seletor?)` | Valor do [contexto compartilhado](/aprender/contexto) |

## React do host nos remotes

`<Remote>` oferece o React do host. Remotes com `dedupe: ['react']` usam essa cópia quando a versão serve. Veja [Dedupe](/aprender/dedupe).
