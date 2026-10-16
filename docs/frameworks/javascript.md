# JS e TypeScript puro

Sem framework. Import: `vitral` e `vitral/element`.

## Host

### Sem build

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json"></vitral-remote>
```

Num projeto com bundler, `import 'vitral/auto'` faz o mesmo.

### Com `configure`

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

```js
const el = document.querySelector('vitral-remote')
el.props = { userId: 43 }   // atualiza sem remontar
el.retry()                  // monta de novo
el.status                   // 'loading' | 'ready' | 'error'
el.addEventListener('vitral-ready', (e) => console.log(e.detail.timings))
el.addEventListener('vitral-error', (e) => console.log(e.detail.error.code))
```

O atributo `props` só aceita JSON. Para passar funções, use a propriedade `el.props`.

| Atributo | O que faz |
| --- | --- |
| `name` | Nome registrado em `configure` |
| `src` | URL do `vitral.json`. Dispensa `configure` |
| `props` | Props em JSON |
| `isolate` | `none`, `shadow` ou `iframe` |
| `loading` | `lazy` ou `idle` |
| `prefetch` | `hover`, `visible` ou `idle` |
| `priority` | `high` |
| `keep-alive` | Guarda o remote montado ao sair da página. Aceita o máximo guardado |
| `inherit-styles` | CSS do host para dentro do Shadow DOM, separado por espaço |

| Slot | Quando aparece |
| --- | --- |
| `fallback` | Enquanto carrega |
| `error` | Se falhar |

Sem os slots, o elemento mostra uma tela padrão de carregando e de erro, com botão de tentar de novo.

### Sem componente

`createSlot` monta um remote num elemento qualquer:

```ts
import { createSlot } from 'vitral'

const slot = createSlot(document.querySelector('#carrinho')!, {
  name: 'carrinho',
  props: { userId: 42 },
  onStatus(status, erro) {
    if (erro) console.log(erro.code)
  },
})

slot.update({ userId: 43 })
slot.set({ name: 'carrinho-v2' }) // remonta
slot.retry()
slot.destroy()
```

Para montar uma vez, sem estado: `await mountRemote(el, 'carrinho', { userId: 42 })` devolve `{ update, unmount }`.

## Remote

### Com `component` e `html`

```ts
// src/remote.ts
import { component, html } from 'vitral'

export default component<{ nome: string }>({
  state: { cliques: 0 },
  render: ({ nome }, state, ctx) => html`
    <p>Olá, ${nome}</p>
    <button onclick=${() => state.cliques++}>cliques: ${state.cliques}</button>
  `,
  mounted(el, state, ctx) {
    const timer = setInterval(() => state.cliques++, 1000)
    return () => clearInterval(timer)
  },
})
```

Sem estado, basta a função:

```ts
export default component(({ nome }) => html`<p>Olá, ${nome}</p>`)
```

- Tudo dentro de `${}` é escapado.
- Mudar `state` ou receber props novas renderiza de novo.
- `on<evento>=${fn}` vira listener.
- `unsafeHTML(texto)` insere HTML sem escape. Use só com HTML confiável.
- `mounted` roda depois do primeiro render. A função devolvida roda no unmount.

### Com o contrato direto

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

`mount` pode ser `async`. `update` é opcional. Esse é o contrato que todos os adaptadores geram.

```js
// vite.config.js
import vitral from 'vitral/vite'

export default { plugins: [vitral({ entry: 'src/remote.ts' })] }
```

## O `ctx`

Todo remote recebe o mesmo `ctx`:

| Campo | O que é |
| --- | --- |
| `name` | Nome com que o host registrou o remote |
| `baseUrl` | URL da pasta do JS. Use para montar URLs de imagens e arquivos |
| `events` | Barramento de eventos. O que o remote assina por aqui é cancelado no unmount |
| `shared` | Contexto compartilhado. Veja [Contexto](/funcionalidades/contexto) |
| `shadowRoot` | O shadow root, com `isolate="shadow"`. Senão `null` |
| `navigate(url, { replace? })` | Navega a página e avisa todos os roteadores |
| `reportError(erro)` | Mostra o erro no host |
| `onActivate(fn)`, `onDeactivate(fn)` | Com keep-alive. Veja [Carregamento](/funcionalidades/carregamento#keep-alive) |
