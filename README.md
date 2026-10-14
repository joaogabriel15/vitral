<p align="center"><img src="docs/logo.svg" width="96" alt="vitral"></p>

<h1 align="center">vitral</h1>

<p align="center"><strong>Feito de partes. Visto como um todo.</strong></p>

[![CI](https://github.com/joaogabriel15/vitral/actions/workflows/ci.yml/badge.svg)](https://github.com/joaogabriel15/vitral/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/vitral)](https://www.npmjs.com/package/vitral)
[![tamanho](https://img.shields.io/bundlejs/size/vitral)](https://bundlejs.com/?q=vitral)
[![licença](https://img.shields.io/npm/l/vitral)](LICENSE)

```bash
npm install vitral
```

Junte micro-frontends de qualquer framework numa página só, sem configuração de build no host.

- Cada app publica um módulo e o host só precisa da URL dele.
- React, Vue, Angular, Svelte e os outros convivem na mesma tela.
- CSS, erros e deploys ficam isolados por app.

```
host (qualquer framework)                 remote (qualquer framework)
┌────────────────────────────┐   URL      ┌──────────────────────────────┐
│ configure({ remotes })     │ ─────────▶ │ vitral.json  { entry, css,   │
│ <Remote name="carrinho" /> │            │              integrity }     │
│                            │ ◀───────── │ remote.js  mount/update/     │
│ events (barramento global) │  import()  │            unmount           │
└────────────────────────────┘            └──────────────────────────────┘
```

## Por que é diferente

| Dor comum (Module Federation, single-spa) | Como o vitral resolve |
|---|---|
| Host e remote precisam de config de build combinada | Host não tem config de build nenhuma. Só `configure({ remotes })` em runtime. |
| `shared` / singletons quebram com versões diferentes de React/Vue | Por padrão cada remote leva o próprio framework, isolado na sua própria root. Nenhum conflito de versão. Compartilhar é opcional (import map). |
| Erro de um remote derruba a página | Cada remote tem estado de loading, erro e "tentar de novo" próprios. |
| CSS de um vaza no outro; Tailwind do remote sem classes ou quebrando o host | O remote leva o próprio CSS, já com escopo automático. `isolate="shadow"` isola de vez, e o `@property` do Tailwind v4 continua funcionando. |
| Cache velho depois do deploy (`ChunkLoadError`) | Arquivos com hash; só o `vitral.json` é revalidado. |
| Roteadores brigando | `navigate(url)` mantém host e remotes na mesma URL. |
| Executar JS de outra origem sem garantia | Allowlist de origens + verificação de hash SRI antes de executar. |
| Muitos conceitos (containers, exposes, lifecycles, root config) | Um contrato: `mount(el, props, ctx) → { update, unmount }`. |

## Frameworks suportados

| Framework | Remote (publicar) | Host (consumir) | Import |
|---|---|---|---|
| React 18/19 | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Next.js (App e Pages Router) | igual ao React | `<Remote>` (já é `'use client'`, SSR seguro) | `vitral/react` |
| Vue 3 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Nuxt 3/4 | igual ao Vue | `<VitralRemote>` (SSR seguro) | `vitral/vue` |
| Angular 17+ (standalone, com ou sem zone.js) | `angularRemote(AppComponent, { providers })` | `<vitral-remote>` + `provideVitral()` | `vitral/angular` |
| Svelte 5 / SvelteKit | `svelteRemote(App)` | `use:remote` ou `<vitral-remote>` | `vitral/svelte` |
| Solid / SolidStart | `solidRemote(App)` | `<Remote>` | `vitral/solid` |
| Preact | `preactRemote(App)` | `<Remote>` | `vitral/preact` |
| Lit, Stencil, Web Components | `elementRemote('meu-widget')` | `<vitral-remote>` | `vitral/element` |
| JS / TypeScript puro | `component(render)` | `<vitral-remote>` | `vitral`, `vitral/element` |
| Qualquer outro (Astro, Qwik, jQuery, HTML do servidor…) | `defineRemote({ mount })` | `<vitral-remote>` | `vitral/element` |

Todas as 72 combinações host × remote dos exemplos (9 hosts × 8 remotes) são
testadas no navegador a cada execução do e2e.

## Uso

### Publicar um remote

```js
// React                                  // Vue
import { reactRemote } from 'vitral/react'  import { vueRemote } from 'vitral/vue'
export default reactRemote(Carrinho)      export default vueRemote(Catalogo, { setup: (app) => app.use(pinia) })

// Svelte (o contexto chega na prop `vitral`)
import { svelteRemote } from 'vitral/svelte'
export default svelteRemote(Cartao)

// Solid / Preact (o contexto chega na prop `vitral`)
export default solidRemote(Cartao)        export default preactRemote(Cartao)

// Angular: props viram inputs; contexto com injectVitral()
import { angularRemote } from 'vitral/angular'
export default angularRemote(CartaoComponent, { providers: [provideHttpClient()] })

// Lit / Web Component: props viram propriedades; contexto em `this.vitral`
import { elementRemote } from 'vitral/element'
export default elementRemote('lit-cartao', () => customElements.define('lit-cartao', LitCartao))
```

JS ou TypeScript puro, sem framework nenhum:

```ts
import { component, html } from 'vitral'

export default component<{ mensagem?: string }>({
  state: { cliques: 0 },
  render: ({ mensagem }, state, ctx) => html`
    <p>${mensagem}</p>
    <button onclick=${() => state.cliques++}>cliques: ${state.cliques}</button>
  `,
})
```

Sem estado, basta a função: ``component(({ nome }) => html`<p>Olá, ${nome}</p>`)``.
Tudo que entra no `${}` é escapado, então dá para colocar dado do usuário sem
risco de XSS. Mudar o `state` ou receber props novas atualiza a tela sozinho.
Se precisar de controle total, `defineRemote({ mount(el, props, ctx) { ... } })`
continua disponível.

Build com o plugin (o mesmo para todos os frameworks):

```js
// vite.config.js
import vitral from 'vitral/vite'
export default { plugins: [react() /* ou vue(), svelte(), solid(), angular()… */, vitral({ entry: 'src/remote.jsx' })] }
```

`vite build` gera `dist/remote-[hash].js`, `dist/remote-[hash].css` e
`dist/vitral.json` (com o hash `sha384` do JS). Suba a pasta em qualquer CDN com
CORS. Para Angular use `@analogjs/vite-plugin-angular` (compila em AOT).

### CSS e Tailwind

Use Tailwind (ou qualquer CSS) no remote normalmente. O plugin prefixa o CSS
com `[data-vitral-scope="nome"]` e transforma `:root`/`html`/`body` na raiz do
remote, então o preflight e o tema não vazam para o host, e o host não precisa
escanear os arquivos do remote. Com `isolate="shadow"`, as regras `@property`
do Tailwind v4 sobem para o documento para que sombras, rings e gradientes
funcionem. Veja [docs/PROBLEMAS.md](docs/PROBLEMAS.md).

Sem Vite? Qualquer bundler serve (webpack, Rspack, esbuild, Rollup, Angular
CLI): basta gerar um módulo ES cujo `default` tenha `mount(el, props, ctx)`.

### Consumir no host (React / Next)

```jsx
import { configure } from 'vitral'
import { Remote, useEventValue } from 'vitral/react'

configure({ remotes: '/remotes.json' })            // ou um objeto { nome: url }

function App() {
  const total = useEventValue('carrinho:total')
  return (
    <Remote
      name="carrinho"
      props={{ userId: 42 }}
      isolate="shadow"
      fallback={<Spinner />}
      error={(err, retry) => <button onClick={retry}>Tentar de novo</button>}
    />
  )
}
```

`<Remote>` já é `'use client'`. No Next ele renderiza o `fallback` no servidor
e monta o remote no cliente, então funciona no App Router e no Pages Router
sem `dynamic(..., { ssr: false })`.

### Consumir no host (Vue / Nuxt)

```vue
<script setup>
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="carrinho" :props="{ userId: 42 }" isolate="shadow">
    <template #fallback>Carregando…</template>
    <template #error="{ error, retry }"><button @click="retry">Tentar de novo</button></template>
  </VitralRemote>
</template>
```

No Nuxt, chame `configure()` num plugin `.client.ts`. O componente renderiza o
fallback no SSR e monta o remote no cliente.

### Consumir no host (JS/TS puro, Angular, Svelte, qualquer coisa)

O Web Component `<vitral-remote>` funciona em qualquer lugar que renderize HTML:

```html
<script type="module">
  import { configure } from 'vitral'
  import { defineVitralElement } from 'vitral/element'
  configure({ remotes: '/remotes.json' })
  defineVitralElement()
</script>

<vitral-remote name="carrinho" props='{"userId": 42}' isolate="shadow">
  <p slot="fallback">Carregando…</p>
  <p slot="error">Indisponível</p>
</vitral-remote>
```

`el.props = {...}` atualiza sem remontar, `el.retry()` remonta, e os eventos
`vitral-ready` / `vitral-error` avisam o estado.

**Angular:**

```ts
bootstrapApplication(App, { providers: [provideVitral({ remotes: '/remotes.json' })] })

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vitral-remote name="carrinho" [props]="{ userId: id() }" (vitral-error)="falhou()"></vitral-remote>`,
})
```

**Svelte:** `<div use:remote={{ name: 'carrinho', props: { userId } }}></div>`
(com `import { remote } from 'vitral/svelte'`).

**Solid / Preact:** `<Remote name="carrinho" props={{ userId }} fallback={…} error={(e, retry) => …} />`.

### Comunicação

```js
import { events } from 'vitral'
events.emit('carrinho:adicionar', produto)
const off = events.on('carrinho:adicionar', (p) => …)
events.last('usuario')          // último valor emitido
```

Dentro de remotes: `useVitral()` (contexto), `useEvent(tipo, fn)` e
`useEventValue(tipo)` existem em `vitral/react` e `vitral/vue`. O barramento é o
mesmo para todos, mesmo que cada remote tenha sua cópia da lib, e o que o
remote assina por `ctx.events` é cancelado sozinho no unmount.

Para navegar de dentro de um remote, use `navigate('/pedidos/42')` (ou
`ctx.navigate`). Ele atualiza o histórico e avisa todos os roteadores.

### Erros

Todo erro é um `RemoteError` com `code`, o nome do remote e `docs`, o link da
página do código com causas e correção ([docs/erros](docs/erros/README.md)).
Falhas de download e erros de render dentro do remote (React, Vue) aparecem no
`error` do componente de host (ou no slot `error` do `<vitral-remote>`), com
`retry` para remontar só aquele remote.

### Configuração

```js
configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' }, // ou URL de um JSON
  allowedOrigins: ['https://cdn.empresa.com'], // padrão: página + origens registradas
  timeout: 15000,
  retries: 1,
  isolate: 'none',                              // ou 'shadow' para todos
})
```

Entradas podem ser objetos: `{ url, integrity, css, isolate }`, ou
`{ module: () => import('./carrinho') }` para um remote local (monorepo) sem
rede. A `integrity`
declarada pelo host vence a do manifesto (fixe o hash no host quando o remote
for de terceiros).

### Mais formas de usar

Vários componentes por remote (`<Remote name="carrinho/MiniCarrinho" />`) e
módulos sem UI (`loadModule('carrinho/api')`). Veja
[docs/formas-de-usar.md](docs/formas-de-usar.md).

## Segurança

- **Allowlist de origens**: nenhum código é importado de origem não permitida,
  nem mesmo se um manifesto apontar para fora.
- **SRI**: quando há `integrity`, a lib baixa o JS, confere o hash sobre os
  bytes e executa exatamente os bytes verificados (via `blob:`). Aceita o
  formato SRI completo: `sha256`, `sha384` ou `sha512`, vários hashes
  separados por espaço (vale o algoritmo mais forte). Com CSP, inclua `blob:`
  em `script-src`.
- **Sem `eval`**, sem iframes, sem globais além de `Symbol.for('vitral')`: um
  objeto com o número do protocolo e métodos, compartilhado por todas as
  cópias da lib na página (host e remotes podem ter versões diferentes).
- Shadow DOM isola CSS, não JS: um remote ainda roda com os privilégios da
  página. Para código não confiável de verdade, use iframe.

## Dependências compartilhadas (opcional)

Para não baixar React/Vue duas vezes, marque-os como `shared` no remote e
declare um import map no host:

```js
vitral({ entry: 'src/remote.jsx', shared: ['react', 'react-dom', 'react-dom/client'] })
```

```html
<script type="importmap">
{ "imports": { "react": "https://esm.sh/react@19.2.0", "react-dom/client": "https://esm.sh/react-dom@19.2.0/client" } }
</script>
```

## Testes

```ts
// Teste do host sem subir nenhum remote
import { mockRemote, failingRemote } from 'vitral/testing'

const carrinho = mockRemote('carrinho', (el, props) => (el.textContent = `itens: ${props.itens}`))
// …renderize o host…
expect(carrinho.lastProps).toEqual({ itens: 2 })
failingRemote('recomendacoes') // para testar a tela de erro
```

No repositório (veja [CONTRIBUTING.md](CONTRIBUTING.md)):

```bash
pnpm install
pnpm check       # build, tipos, publint/attw, tamanho e testes unitários
pnpm test:e2e    # builda tudo e roda o Playwright: 9 hosts × 8 remotes + demo
pnpm examples    # sobe os exemplos (hosts em :4201-:4207, remotes em :4100)
node bench/run.mjs  # benchmark: 3 remotes React + 1 Vue em 4G lento (bench/)
```

O CI roda `pnpm check` em Node 22 e 24, o e2e em Chromium, Firefox e WebKit e,
em cada PR, o benchmark contra a main: o PR falha se alguma métrica ficar mais
de 10% pior. A lib pede Node 20.19 ou mais novo para build e SSR. Versões novas saem
pelo Changesets: `pnpm changeset`, merge do PR "Versionar pacote" e o GitHub
Actions publica no npm com proveniência.

## Exemplos e demo

- `examples/remotes/*`: o mesmo cartão em React, Vue, Svelte, Solid, Preact,
  Angular, Lit e TypeScript puro.
- `examples/hosts/*`: hosts em JS puro (:4201), React (:4202), Vue (:4203),
  Svelte (:4204), Solid (:4205), Preact (:4206), Angular (:4207), Next (:4208,
  `pnpm --dir examples/hosts/next start`) e Nuxt (:4209,
  `pnpm --dir examples/hosts/nuxt start`), cada um carregando os 8 remotes.
- `demo/`: catálogo Vue + carrinho React com Tailwind (`pnpm demo`, em
  http://localhost:5173 e :5174).

## Estado

Protótipo 0.1. Testado (86 testes unitários, mais de 90% de cobertura no
núcleo, e 43 e2e em Chromium, Firefox e WebKit): carregamento via
manifesto com SRI, Shadow DOM, props reativas sem remontar, props que mudam
durante o download, desmontar/remontar, StrictMode do React, erros de download
e de render, eventos entre frameworks, Tailwind v4 com e sem Shadow DOM, escopo
de CSS e SSR em Next e Nuxt. O que ainda falta está em
[docs/PROBLEMAS.md](docs/PROBLEMAS.md#ainda-não-resolvidos-próximos-passos-sugeridos).
