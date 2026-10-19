# Migrar do Module Federation

O Module Federation compartilha módulos entre builds: host e remote combinam `remotes`, `exposes` e `shared` no build. No vitral, o remote publica um componente com `mount`, e o host só conhece a URL do `vitral.json`.

## Equivalências

| Module Federation | vitral |
| --- | --- |
| `remotes` no plugin do host | `configure({ remotes })` em runtime, sem plugin no host |
| `remoteEntry.js` | `vitral.json` |
| `exposes: { './Carrinho': … }` | `export default reactRemote(Carrinho)` e `exposes` no plugin. Veja [Exposes](/aprender/exposes) |
| `React.lazy(() => import('carrinho/Carrinho'))` | `<Remote name="carrinho" />` |
| `shared` com `singleton` | Cada remote leva o próprio framework. Opcional: [`dedupe`](/aprender/dedupe) |
| Props do componente React | `props`, iguais em qualquer framework |
| `ErrorBoundary` em volta do lazy | `error` do `<Remote>`, com `retry` |
| `dts-plugin` (tipos) | `npx vitral types`. Veja [Desenvolvimento](/aprender/desenvolvimento#tipos-das-props) |
| Módulos sem UI (funções, stores) | `loadModule('carrinho/api')` |

## Passo a passo: um carrinho em React

### Antes, no remote

```js
// webpack.config.js (ou rspack.config.js)
new ModuleFederationPlugin({
  name: 'carrinho',
  filename: 'remoteEntry.js',
  exposes: { './Carrinho': './src/Carrinho' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

### Depois, no remote

Troque o bundler do remote por Vite, ou mantenha o bundler atual e gere um ES module (veja [Outros bundlers](/referencia/vitral/configure#outros-bundlers)).

```jsx
// src/remote.jsx
import { reactRemote } from 'vitral/react'
import Carrinho from './Carrinho'

export default reactRemote(Carrinho)
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/remote.jsx' })] }
```

O componente `Carrinho` não muda.

### Antes, no host

```js
new ModuleFederationPlugin({
  name: 'loja',
  remotes: { carrinho: 'carrinho@https://cdn.empresa.com/carrinho/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```jsx
const Carrinho = React.lazy(() => import('carrinho/Carrinho'))

<ErrorBoundary fallback={<Erro />}>
  <Suspense fallback={<Carregando />}>
    <Carrinho userId={42} />
  </Suspense>
</ErrorBoundary>
```

### Depois, no host

Remova o plugin de federação do build do host.

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

<Remote
  name="carrinho"
  props={{ userId: 42 }}
  fallback={<Carregando />}
  error={(erro, tentarDeNovo) => <Erro onRetry={tentarDeNovo} />}
/>
```

### Migrar aos poucos

Migre um remote por vez. O host mantém o plugin de federação para os remotes que ainda não migraram e usa `<Remote>` para os que já migraram. Quando o último sair, remova o plugin.

## O que muda no comportamento

- Cada remote monta na própria root React. Contexto React do host (`useContext`) não atravessa para o remote; passe o valor por props.
- Sem `shared`, cada remote baixa o próprio React. Veja [Dedupe](/aprender/dedupe).
- O host não precisa de build novo quando um remote muda de versão: o `vitral.json` é revalidado a cada carga.
