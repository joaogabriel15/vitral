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

Para gerar host e remote prontos: `npm create vitral@latest`.

**1. No remote**, exporte o componente e use o plugin:

```jsx
// src/App.jsx (ou .vue, .svelte, .tsx…)
export default function Carrinho({ userId }) { … }
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

O plugin descobre o framework e embrulha o `export default` com o adaptador certo. A entrada padrão é `src/remote.*` ou `src/App.*`.

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

Sem build no host, numa página HTML qualquer:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>
<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json"></vitral-remote>
```

Todos os componentes de host aceitam `src` no lugar de `name`.

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

## Desenvolvimento

- **HMR:** com o remote em `vite dev`, aponte o host para `http://localhost:5174/vitral.json`. Editar o remote atualiza o host sem recarregar a página.
- **Overrides:** `http://localhost:3000/?vitral=carrinho@http://localhost:5174` troca a URL de um remote sem mexer no host. Só vale em `localhost` ou com `configure({ devOverrides: true })`. Para guardar no navegador, use `devtools()` de `vitral/devtools`.
- **Tipos das props:** o build publica `vitral.d.ts`. No host, `npx vitral types` gera `vitral-env.d.ts`, e uma prop errada passa a não compilar.

## Comunicação entre remotes

```js
import { events } from 'vitral'

events.emit('carrinho:total', 120)
const parar = events.on('carrinho:total', (total) => console.log(total))
events.last('carrinho:total') // 120
```

Todos os remotes usam o mesmo barramento. O que um remote assina é cancelado quando ele desmonta.

Para estado comum (usuário, tema, carrinho), use o contexto compartilhado:

```js
import { provide, shared } from 'vitral'

provide('usuario', { id: 42 })                    // host: cria e é o dono
provide('tema', 'claro', { writable: false })     // só o dono altera
shared('tema').subscribe((tema) => console.log(tema))
const nome = useShared('usuario', (u) => u?.nome) // React, Preact, Vue e Solid
```

Angular usa `injectShared`, Svelte usa `$tema` e Lit usa `SharedController`. Detalhes em [Contexto compartilhado](https://joaogabriel15.github.io/vitral/aprender/contexto).

Para mudar de página de dentro de um remote, use `navigate('/pedidos/42')`. Todos os roteadores da página recebem a mudança.

## CSS e Tailwind

Use Tailwind ou qualquer CSS no remote. O plugin prefixa o CSS para valer só dentro do remote, então o CSS de um remote não muda o host nem os outros remotes.

Para isolar por completo, use Shadow DOM:

```jsx
<Remote name="carrinho" isolate="shadow" />
```

Com Shadow DOM, as regras `@property` e `@font-face` sobem para o documento, então sombras, rings, gradientes e fontes do Tailwind v4 funcionam. O plugin já faz essa separação no build (campo `shadow` do `vitral.json`): a página só adota o CSS pronto. Manifestos antigos continuam funcionando, com a separação feita no navegador.

O remote também pode usar o tema do host:

```js
vitral({ theme: 'host' })                                  // var(--x) usa o valor do host, se existir
configure({ styles: { inherit: ['/assets/base.css'] } })   // CSS base do host dentro do Shadow DOM
```

Tema com Tailwind v4, dark mode, CSS legado e Tailwind v3 no host: [Estilos](https://joaogabriel15.github.io/vitral/aprender/estilos).

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

## Performance

Remote com `import()` também gera `dist/split/`: o navegador baixa só o que o remote usa ao abrir, e o resto chega no `import()`, conferido pelo mesmo hash. Hosts antigos continuam usando o arquivo único.

No CDN, sirva `vitral.json` com `Cache-Control: no-cache` e o resto (nome com hash) com `public, max-age=31536000, immutable`.


Assim que o manifesto chega, o JS e o CSS do remote baixam juntos. A montagem
espera os dois, para o remote não aparecer sem estilo. `configure()` abre a
conexão com a origem de cada remote (`<link rel="preconnect">`).

```js
import { preload } from 'vitral'
// Baixa JS e CSS sem montar, por exemplo no hover de um link
link.addEventListener('pointerenter', () => preload('checkout'), { once: true })
```

Nos componentes de host e no `<vitral-remote>`:

```html
<!-- monta perto de aparecer na tela; reserve o espaço para a página não pular -->
<vitral-remote name="comentarios" loading="lazy" style="display:block;min-height:400px"></vitral-remote>
<!-- monta com o navegador ocioso, mas já baixa no hover -->
<vitral-remote name="checkout" loading="idle" prefetch="hover"></vitral-remote>
<!-- remote que aparece logo ao abrir a página -->
<vitral-remote name="cabecalho" priority="high"></vitral-remote>
```

```jsx
<Remote name="checkout" loading="lazy" prefetch="visible" keepAlive />
```

| Opção | Valores | O que faz |
| --- | --- | --- |
| `loading` | `lazy`, `idle` | Monta a 200px de aparecer na tela, ou com o navegador ocioso |
| `prefetch` | `hover`, `visible`, `idle` | Chama `preload()` antes de montar |
| `priority` | `high` | `fetchpriority` alto no manifesto, no JS e no CSS |
| `keepAlive` (`keep-alive`) | `true` ou o máximo | Ao sair da página, o remote vai para um contêiner oculto (LRU, padrão 5); na volta só recebe as props novas |

Com keep-alive, o remote pode pausar timers e assinaturas:

```js
mount(el, props, ctx) {
  ctx.onDeactivate?.(() => clearInterval(timer))
  ctx.onActivate?.(() => (timer = setInterval(tick, 1000)))
}
```

### Métricas

Cada etapa do carregamento vira um `performance.measure` com o nome
`vitral:<remote>:<etapa>`. As etapas são `manifest`, `js`, `css` e `mount`.
Elas aparecem na aba Performance do DevTools. Para mandar ao seu RUM:

```js
configure({
  onMetric: ({ name, stage, duration }) => rum.send(`vitral.${stage}`, duration, { remote: name }),
})
```

O evento `vitral-ready` (e o `ready` do componente Vue) traz os tempos em
`detail.timings`, por exemplo `{ manifest: 12.3, js: 40.1, css: 8, mount: 2.4 }`.
Um remote local (`module`) só mede `css` e `mount`. Erros dentro do
`onMetric` são ignorados.

## Dependências compartilhadas

Para não baixar React ou Vue mais de uma vez, liste-os em `dedupe` no remote:

```js
vitral({ dedupe: ['react'] })
```

O remote usa a cópia que já está na página quando a versão serve (padrão: `^` da versão instalada no remote) e baixa a própria só quando não serve. Os componentes de host em React oferecem o React do host sem configuração.

### Mais formas de usar

Vários componentes por remote (`<Remote name="carrinho/MiniCarrinho" />`),
módulos sem UI (`loadModule('carrinho/api')`), deploy novo sem recarregar a
página (`watchUpdates()` e `refresh('carrinho')`) e app shell por rota
(`routes()` e `<vitral-outlet>`, em `vitral/routes`). Veja
[Exposes](https://joaogabriel15.github.io/vitral/aprender/exposes), [Atualização sem reload](https://joaogabriel15.github.io/vitral/aprender/atualizacoes) e [Rotas](https://joaogabriel15.github.io/vitral/aprender/rotas).

## Segurança

- Só importa JS de origens permitidas, mesmo que o `vitral.json` aponte para outra. O `src` de um componente de host entra na allowlist; o atributo `src` do `<vitral-remote>` não entra quando há `allowedOrigins`.
- Com `integrity`, nada roda sem o hash conferir. A lib usa o primeiro caminho que o navegador garante: import map com `integrity` (Chrome 133+, Safari 18.4+), `<link rel="modulepreload" integrity>` (Firefox 115+) ou, nos outros, baixa, confere e executa exatamente os bytes conferidos via `blob:`. Aceita `sha256`, `sha384` e `sha512`, e vários hashes separados por espaço (vale o mais forte). O CSS do manifesto também é conferido.
- Com CSP, a lib copia o `nonce` de um `<script nonce>` da página para o import map. Sem nonce, cai para o `modulepreload`.
- O hash só protege contra CDN comprometido se vier de outro lugar: fixe `integrity` no host ou embuta o manifesto (`{ url, manifest }`).
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
- [Como contribuir](https://github.com/joaogabriel15/vitral/blob/main/CONTRIBUTING.md)
- Licença [MIT](https://github.com/joaogabriel15/vitral/blob/main/LICENSE)
