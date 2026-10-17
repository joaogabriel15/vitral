# Migrar do single-spa

O single-spa e o vitral usam o mesmo modelo: o remote exporta funções de ciclo de vida e o host monta. A diferença está em quem escolhe o remote: no single-spa é a root config, por rota; no vitral é o componente do host.

## Equivalências

| single-spa | vitral |
| --- | --- |
| `registerApplication({ name, app })` | `configure({ remotes: { nome: url } })` |
| Import map e SystemJS | `vitral.json` |
| `bootstrap`, `mount`, `unmount` | `mount(el, props, ctx)` devolvendo `{ update, unmount }` |
| `update` de parcels | `update(props)`, sempre disponível |
| `customProps` | `props` |
| `activeWhen` | O roteador do host renderiza `<Remote>` na rota. Veja [Rotas](/funcionalidades/rotas) |
| `single-spa-react`, `single-spa-vue`… | `reactRemote`, `vueRemote`… |
| `mountRootParcel` | `<Remote>`, `<vitral-remote>` ou `createSlot` |
| `navigateToUrl` | `navigate` |
| Root config sem framework | `<vitral-remote>` |
| Layout por rota sem framework | `routes()` e `<vitral-outlet>` |

## Passo a passo: um app React

### Antes, no remote

```jsx
import React from 'react'
import ReactDOMClient from 'react-dom/client'
import singleSpaReact from 'single-spa-react'
import Root from './Root'

const lifecycles = singleSpaReact({ React, ReactDOMClient, rootComponent: Root })
export const { bootstrap, mount, unmount } = lifecycles
```

### Depois, no remote

```jsx
import { reactRemote } from 'vitral/react'
import Root from './Root'

export default reactRemote(Root)
```

Com o plugin `vitral/vite`, o build gera o `vitral.json`. Com outro bundler, gere um ES module (não SystemJS) e registre a URL do JS.

### Antes, na root config

```js
import { registerApplication, start } from 'single-spa'

registerApplication({
  name: '@empresa/conta',
  app: () => System.import('@empresa/conta'),
  activeWhen: ['/conta'],
  customProps: { authToken },
})
start()
```

### Depois, no host

Com um roteador:

```jsx
configure({ remotes: { conta: 'https://cdn.empresa.com/conta/vitral.json' } })

{ path: '/conta/*', element: <Remote name="conta" props={{ authToken }} /> }
```

Sem framework, use `vitral/routes`:

```html
<vitral-outlet></vitral-outlet>

<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({
    remotes: {
      conta: 'https://cdn.empresa.com/conta/vitral.json',
      checkout: 'https://cdn.empresa.com/checkout/vitral.json',
    },
  })
  routes({ '/conta/*': 'conta', '/checkout/*': 'checkout' })
</script>
```

Veja [Rotas](/funcionalidades/rotas).

## O que muda no comportamento

- Não há `bootstrap` separado. O que rodava nele vai para o começo de `mount` ou para o topo do módulo.
- `update(props)` existe em todo remote: mudar props não remonta.
- A falha de um remote fica nele. O `error` do componente mostra a tela de erro, e `retry` tenta de novo.
