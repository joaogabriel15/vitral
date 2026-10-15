# Remote

Um remote é um ES module cujo `default` tem `mount(el, props, ctx)`. O adaptador de cada framework escreve esse objeto. O plugin `vitral/vite` gera o arquivo e o `vitral.json`.

## Adaptadores

```jsx
// React
import { reactRemote } from 'vitral/react'
export default reactRemote(Carrinho)
```

```ts
// Vue: setup instala plugins no app do remote
import { vueRemote } from 'vitral/vue'
export default vueRemote(Catalogo, { setup: (app, ctx) => app.use(pinia) })
```

```ts
// Angular: props viram inputs; o contexto vem de injectVitral()
import { angularRemote } from 'vitral/angular'
export default angularRemote(CartaoComponent, { providers: [provideHttpClient()] })
```

```ts
// Svelte, Solid e Preact: o contexto chega na prop `vitral`
import { svelteRemote } from 'vitral/svelte'
export default svelteRemote(Cartao)
```

```ts
// Lit e Web Components: props viram propriedades; o contexto fica em `this.vitral`
import { elementRemote } from 'vitral/element'
export default elementRemote('lit-cartao', () => customElements.define('lit-cartao', LitCartao))
```

Nos remotes React e Vue, erros de render vão para o `error` do host em vez de sumir no console. Nos outros, chame `ctx.reportError(erro)`.

## Sem framework

```ts
import { component, html } from 'vitral'

export default component<{ nome: string }>({
  state: { cliques: 0 },
  render: ({ nome }, state, ctx) => html`
    <p>Olá, ${nome}</p>
    <button onclick=${() => state.cliques++}>cliques: ${state.cliques}</button>
  `,
})
```

Sem estado, basta a função:

```ts
export default component(({ nome }) => html`<p>Olá, ${nome}</p>`)
```

Tudo que entra em `${}` é escapado. Mudar `state` ou receber props novas renderiza de novo. Funções em `on<evento>=${fn}` viram listeners. Para HTML confiável, use `unsafeHTML(texto)`. `mounted(el, state, ctx)` roda depois do primeiro render e pode devolver uma função de limpeza.

Para controle total, escreva o contrato:

```ts
import { defineRemote } from 'vitral'

export default defineRemote<{ nome: string }>({
  mount(el, props, ctx) {
    el.textContent = `Olá, ${props.nome}`
    return {
      update: (next) => (el.textContent = `Olá, ${next.nome}`),
      unmount: () => el.replaceChildren(),
    }
  },
})
```

`mount` pode ser `async`. `update` é opcional.

## O contexto (`ctx`)

| Campo | O que é |
| --- | --- |
| `name` | Nome com que o host registrou o remote |
| `baseUrl` | URL da pasta de onde o JS veio. Use para montar a URL de imagens e outros arquivos |
| `events` | Barramento compartilhado. O que o remote assina por aqui é cancelado no unmount |
| `shadowRoot` | O shadow root, quando o host pediu `isolate="shadow"`. Senão `null` |
| `navigate(url)` | Navega a página inteira e avisa todos os roteadores |
| `reportError(erro)` | Mostra o erro no host. Os adaptadores React e Vue já chamam |
| `protocol` | Versão do protocolo do host (hoje `1`). Hosts antigos não mandam |

Como chegar no `ctx` em cada framework:

| Framework | Como |
| --- | --- |
| React | `useVitral()` de `vitral/react` |
| Vue | `useVitral()` de `vitral/vue` |
| Angular | `injectVitral()` ou `inject(VITRAL_CONTEXT)` de `vitral/angular` |
| Svelte, Solid, Preact | prop `vitral` |
| Lit e Web Components | `this.vitral` |
| `component()` | terceiro argumento de `render` |

## Build com Vite

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [react(), vitral({ entry: 'src/remote.jsx' })],
}
```

O plugin é o mesmo para todos os frameworks. Troque `react()` por `vue()`, `svelte()`, `solid()` ou `preact()`. Para Angular, use `@analogjs/vite-plugin-angular`.

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `entry` | obrigatório | Arquivo que exporta o remote |
| `name` | `name` do `package.json` | Nome no `vitral.json` e no escopo do CSS |
| `version` | `version` do `package.json` | Versão no `vitral.json` |
| `scopeCss` | `true` | Prefixa o CSS para valer só dentro do remote. Veja [Estilos](./estilos) |
| `shared` | nenhuma | Dependências que ficam fora do bundle e vêm do import map do host. Veja [Performance](./performance#dependencias-compartilhadas) |

`vite build` gera:

```
dist/
  remote-[hash].js
  remote-[hash].css
  vitral.json
```

```json
{
  "name": "carrinho",
  "version": "1.4.0",
  "entry": "remote-a1b2c3.js",
  "css": ["remote-d4e5f6.css"],
  "integrity": "sha384-…",
  "scope": "carrinho"
}
```

Publique a pasta `dist` em qualquer CDN com CORS. Só o `vitral.json` muda de nome a cada deploy; os outros arquivos têm hash no nome.

## Outros bundlers

O host aceita a URL do JS direto, sem `vitral.json`. Qualquer bundler serve (webpack, Rspack, Rollup, esbuild, Angular CLI), desde que gere um ES module com `mount` no `default`:

```ts
configure({
  remotes: {
    carrinho: {
      url: 'https://cdn.empresa.com/carrinho/remote.js',
      css: ['https://cdn.empresa.com/carrinho/remote.css'],
      integrity: 'sha384-…',
    },
  },
})
```

Sem o plugin, o CSS não é prefixado. Use `isolate: 'shadow'` ou prefixe o CSS você mesmo.

::: info Em breve
Remote sem adaptador (o plugin descobre o framework), modo dev com HMR, tipos das props entre deploys e geração do `vitral.json` para outros bundlers.
:::
