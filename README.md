<p align="center"><img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/logo.svg" width="96" alt="vitral"></p>

<h1 align="center">vitral</h1>

<p align="center"><strong>Feito de partes. Visto como um todo.</strong></p>

<p align="center">
  <a href="https://github.com/joaogabriel15/vitral/actions/workflows/ci.yml"><img src="https://github.com/joaogabriel15/vitral/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/vitral"><img src="https://img.shields.io/npm/v/vitral" alt="npm"></a>
  <a href="https://bundlejs.com/?q=vitral"><img src="https://img.shields.io/bundlejs/size/vitral" alt="tamanho"></a>
  <a href="https://github.com/joaogabriel15/vitral/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/vitral" alt="licença MIT"></a>
</p>

Junte micro-frontends de qualquer framework numa página só, sem configuração de build no host.

```bash
npm install vitral
```

- O host só precisa da URL de cada remote.
- React, Vue, Angular, Svelte, Solid, Preact, Lit e JS puro na mesma página.
- Cada remote tem o próprio CSS, os próprios erros e o próprio deploy.

## Começo rápido

**1. No remote**, exporte o componente:

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

`vite build` gera o JS, o CSS e um `vitral.json`. Publique a pasta `dist` em qualquer CDN com CORS.

**2. No host**, registre a URL e use o componente:

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

Pronto. Mudar `props` atualiza o remote sem remontar.

## Frameworks

| Framework | Remote | Host | Import |
|---|---|---|---|
| React 18/19 | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Next.js (App e Pages Router) | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Vue 3 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Nuxt 3/4 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Angular 17+ | `angularRemote(Component, { providers })` | `<vitral-remote>` + `provideVitral()` | `vitral/angular` |
| Svelte 5 | `svelteRemote(App)` | `use:remote` | `vitral/svelte` |
| Solid | `solidRemote(App)` | `<Remote>` | `vitral/solid` |
| Preact | `preactRemote(App)` | `<Remote>` | `vitral/preact` |
| Lit e Web Components | `elementRemote('meu-widget')` | `<vitral-remote>` | `vitral/element` |
| JS e TypeScript puro | `component({ render })` | `<vitral-remote>` | `vitral` |

No Next e no Nuxt o componente renderiza o `fallback` no servidor e monta o remote no cliente.

### Host em Vue

```vue
<script setup>
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="carrinho" :props="{ userId: 42 }">
    <template #fallback>Carregando…</template>
    <template #error="{ retry }"><button @click="retry">Tentar de novo</button></template>
  </VitralRemote>
</template>
```

### Host em qualquer outro lugar

`<vitral-remote>` funciona em HTML puro, Angular, Svelte, Astro ou HTML gerado no servidor:

```html
<script type="module">
  import { configure } from 'vitral'
  import { defineVitralElement } from 'vitral/element'

  configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })
  defineVitralElement()
</script>

<vitral-remote name="carrinho" props='{"userId": 42}'>
  <p slot="fallback">Carregando…</p>
  <p slot="error">Indisponível</p>
</vitral-remote>
```

### Remote sem framework

```ts
import { component, html } from 'vitral'

export default component<{ nome: string }>({
  state: { cliques: 0 },
  render: ({ nome }, state) => html`
    <p>Olá, ${nome}</p>
    <button onclick=${() => state.cliques++}>cliques: ${state.cliques}</button>
  `,
})
```

O que entra em `${}` é escapado. Mudar `state` ou as props atualiza a tela.

## Comunicação entre remotes

```js
import { events } from 'vitral'

events.emit('carrinho:total', 120)
const parar = events.on('carrinho:total', (total) => console.log(total))
events.last('carrinho:total') // 120
```

Todos os remotes usam o mesmo barramento. O que um remote assina é cancelado quando ele desmonta.

Para mudar de página de dentro de um remote, use `navigate('/pedidos/42')`. Todos os roteadores da página recebem a mudança.

## CSS e Tailwind

Use Tailwind ou qualquer CSS no remote. O plugin prefixa o CSS para valer só dentro do remote, então o CSS de um remote não muda o host nem os outros remotes.

Para isolar por completo, use Shadow DOM:

```jsx
<Remote name="carrinho" isolate="shadow" />
```

## Configuração

```js
configure({
  remotes: '/remotes.json',                    // ou { nome: url }
  allowedOrigins: ['https://cdn.empresa.com'], // padrão: a página e as origens registradas
  timeout: 15000,                              // ms por download
  retries: 1,                                  // novas tentativas em erro de rede
  isolate: 'none',                             // ou 'shadow'
})
```

Cada remote também aceita um objeto:

```js
configure({
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/vitral.json', integrity: 'sha384-…' },
    menu: { module: () => import('./menu') }, // remote local, sem rede
  },
})
```

## Erros

Todo erro é um `RemoteError` com `code`, o nome do remote e `docs`, o link da [página do erro](https://github.com/joaogabriel15/vitral/tree/main/docs/erros) com causas e correção. Um remote que falha mostra o próprio erro e não derruba a página. `retry` monta só aquele remote de novo.

| `code` | Quando |
|---|---|
| `NOT_REGISTERED` | Nome não registrado em `configure` |
| `ORIGIN_BLOCKED` | URL fora de `allowedOrigins` |
| `TIMEOUT` | Não respondeu dentro de `timeout` |
| `INTEGRITY` | O hash do JS não confere |
| `INVALID_MODULE` | O arquivo não exporta `mount()` |
| `LOAD_FAILED` | Erro de rede ou HTTP |
| `MOUNT_FAILED` | O remote lançou erro ao montar |
| `RENDER_FAILED` | O remote quebrou depois de montado |

## Segurança

- Só importa JS de origens permitidas, mesmo que o `vitral.json` aponte para outra.
- Com `integrity`, confere o hash do JS antes de executar e executa exatamente os bytes conferidos. Aceita `sha256`, `sha384` e `sha512`, e vários hashes separados por espaço (vale o mais forte). Com CSP, inclua `blob:` em `script-src`.
- Sem `eval` e sem iframes.
- Shadow DOM isola o CSS, não o JS. Para código de terceiros em que você não confia, use iframe.

## Testes do host

```ts
import { mockRemote, failingRemote } from 'vitral/testing'

const carrinho = mockRemote('carrinho', (el, props) => (el.textContent = `itens: ${props.itens}`))
// renderize o host
expect(carrinho.lastProps).toEqual({ itens: 2 })

failingRemote('recomendacoes') // testa a tela de erro
```

## Comparado com Module Federation e single-spa

| | Module Federation / single-spa | vitral |
|---|---|---|
| Build do host | Config combinada com cada remote | Nenhuma. Só `configure()` |
| Versões de React/Vue | `shared` e singletons, conflitos de versão | Cada remote leva a sua. Compartilhar é opcional |
| Remote fora do ar | Pode derrubar a página | Só aquele remote mostra erro |
| CSS | Vaza entre apps | Escopo automático ou Shadow DOM |
| Deploy novo | `ChunkLoadError` com cache velho | Arquivos com hash; só o `vitral.json` revalida |
| Conceitos | Containers, exposes, lifecycles, root config | `mount(el, props, ctx)` → `{ update, unmount }` |

## Links

- [Exemplos](https://github.com/joaogabriel15/vitral/tree/main/examples): o mesmo remote em 8 frameworks e 9 hosts.
- [Problemas resolvidos](https://github.com/joaogabriel15/vitral/blob/main/docs/PROBLEMAS.md) e o que ainda falta.
- [Como contribuir](https://github.com/joaogabriel15/vitral/blob/main/CONTRIBUTING.md)
- [Benchmark](https://github.com/joaogabriel15/vitral/tree/main/bench)
- Licença [MIT](https://github.com/joaogabriel15/vitral/blob/main/LICENSE)
