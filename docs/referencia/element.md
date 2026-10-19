# vitral/element

`<vitral-remote>` funciona em qualquer HTML: JS puro, Angular, Lit, Astro, templates de servidor.

```ts
import { defineVitralElement, elementRemote, SharedController } from 'vitral/element'
```

## &lt;vitral-remote&gt;

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

`import 'vitral/auto'` registra o elemento sem chamar nada. Para um widget em site de terceiros, com uma tag `<script>` só, veja [embed.js](/aprender/terceiros).

| Atributo | O que faz |
| --- | --- |
| `name` | Nome registrado em `configure` |
| `src` | URL do `vitral.json`. Dispensa `configure` |
| `props` | Props em JSON |
| `isolate` | `none`, `shadow` ou `iframe` |
| `loading` | `lazy` ou `idle` |
| `prefetch` | `hover`, `visible` ou `idle` |
| `priority` | `high` |
| `keep-alive` | Guarda o remote montado. Aceita o máximo guardado |
| `inherit-styles` | CSS do host para dentro do Shadow DOM, separado por espaço |

| Propriedade, método ou evento | O que faz |
| --- | --- |
| `el.props = {...}` | Atualiza sem remontar. Aceita funções |
| `el.status` | `'loading'`, `'ready'` ou `'error'` |
| `el.retry()` | Monta de novo |
| `vitral-ready` | `e.detail.timings`: `{ manifest, js, css, mount }` em ms |
| `vitral-error` | `e.detail.error`: um [`RemoteError`](/referencia/vitral/remote-error) |

Sem os slots, mostra um carregando e um erro com botão de tentar de novo.

## defineVitralElement

```ts
defineVitralElement(tag?: string): void
```

Registra o elemento. Padrão `'vitral-remote'`. Pode ser chamado mais de uma vez.

## elementRemote

```ts
elementRemote<P>(tag: string, setup?: (registry: CustomElementRegistry) => string | void): RemoteModule<P>
```

```js
export default elementRemote('meu-carrinho', (registry) => {
  if (!registry.get('meu-carrinho')) registry.define('meu-carrinho', Carrinho)
})
```

Publica um Web Component como remote. As props viram propriedades do elemento. O `ctx` fica em `element.vitral`.

`setup` roda em cada montagem e recebe o registro do remote ([`ctx.customElements`](/aprender/estilos#custom-elements-de-cada-remote), ou o global em hosts antigos). O elemento é criado com esse registro. Se `setup` devolver uma string, ela é a tag do elemento no lugar de `tag`.

## SharedController

```ts
new SharedController(host, key, select?)
```

```js
class Perfil extends LitElement {
  usuario = new SharedController(this, 'usuario')
  render() {
    return html`${this.usuario.value?.nome}`
  }
}
```

Controller do Lit. Assina enquanto o elemento está conectado e pede novo render quando o valor muda.
