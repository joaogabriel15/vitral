# Começo rápido

Um remote é um app publicado em qualquer CDN. O host é a página que mostra os remotes. O host só precisa da URL do `vitral.json` de cada remote.

```bash
npm install vitral
```

## 1. Remote

Exporte o componente com o adaptador do framework:

```jsx
// src/remote.jsx
import { reactRemote } from 'vitral/react'
import Carrinho from './Carrinho'

export default reactRemote(Carrinho)
```

Adicione o plugin:

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/remote.jsx' })] }
```

`vite build` gera o JS, o CSS e um `vitral.json`. Publique a pasta `dist` em qualquer CDN com CORS.

## 2. Host

Registre a URL e use o componente:

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})

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

Mudar `props` atualiza o remote sem remontar.

## O contrato

Todo remote é um ES module que exporta `mount`:

```ts
export default {
  mount(el, props, ctx) {
    el.textContent = `Olá, ${props.nome}`
    return {
      update(props) { el.textContent = `Olá, ${props.nome}` },
      unmount() { el.textContent = '' },
    }
  },
}
```

Os adaptadores (`reactRemote`, `vueRemote` e os outros) escrevem esse objeto para você. Qualquer bundler serve, desde que o arquivo final seja um ES module.

## Frameworks

| Framework | Remote | Host | Import |
| --- | --- | --- | --- |
| React 18 e 19 | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Next.js (App e Pages Router) | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Vue 3 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Nuxt 3 e 4 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Angular 17+ | `angularRemote(Component, { providers })` | `<vitral-remote>` e `provideVitral()` | `vitral/angular` |
| Svelte 5 | `svelteRemote(App)` | `use:remote` | `vitral/svelte` |
| Solid | `solidRemote(App)` | `<Remote>` | `vitral/solid` |
| Preact | `preactRemote(App)` | `<Remote>` | `vitral/preact` |
| Lit e Web Components | `elementRemote('meu-widget')` | `<vitral-remote>` | `vitral/element` |
| JS e TypeScript puro | `component({ render })` | `<vitral-remote>` | `vitral` |

Host e remote não precisam usar o mesmo framework. Os exemplos do repositório cruzam [9 hosts e 8 remotes](https://github.com/joaogabriel15/vitral/tree/main/examples) no e2e.

Próximos passos: [Host](./host), [Remote](./remote) e [Comunicação](./contexto).
