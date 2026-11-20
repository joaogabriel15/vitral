# vitral/element

`<vitral-remote>` works in any HTML: plain JS, Angular, Lit, Astro, server templates.

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

<vitral-remote name="cart" props='{"userId": 42}' isolate="shadow">
  <p slot="fallback">Loading…</p>
  <p slot="error">Unavailable</p>
</vitral-remote>
```

`import 'vitral/auto'` registers the element without calling anything. For a widget on a third-party site, with a single `<script>` tag, see [embed.js](/en/aprender/terceiros).

| Attribute | What it does |
| --- | --- |
| `name` | Name registered in `configure` |
| `src` | URL of `vitral.json`. No `configure` needed |
| `props` | Props as JSON |
| `isolate` | `none`, `shadow`, `iframe` or `reframe` |
| `loading` | `lazy` or `idle` |
| `prefetch` | `hover`, `visible` or `idle` |
| `priority` | `high` |
| `keep-alive` | Keeps the remote mounted. Accepts the maximum kept |
| `wait-for` | `provide` keys that must have a value before mounting, separated by spaces |
| `inherit-styles` | Host CSS inside the Shadow DOM, separated by spaces |

| Property, method or event | What it does |
| --- | --- |
| `el.props = {...}` | Updates without remounting. Accepts functions |
| `el.status` | `'loading'`, `'ready'` or `'error'` |
| `el.retry()` | Mounts again |
| `vitral-ready` | `e.detail.timings`: `{ manifest, js, css, mount }` in ms |
| `vitral-error` | `e.detail.error`: a [`RemoteError`](/en/referencia/vitral/remote-error) |

Without the slots, it shows a loading screen and an error screen with a try again button.

## defineVitralElement

```ts
defineVitralElement(tag?: string): void
```

Registers the element. Default `'vitral-remote'`. Can be called more than once.

## elementRemote

```ts
elementRemote<P>(tag: string, setup?: (registry: CustomElementRegistry) => string | void): RemoteModule<P>
```

```js
export default elementRemote('my-cart', (registry) => {
  if (!registry.get('my-cart')) registry.define('my-cart', Cart)
})
```

Publishes a Web Component as a remote. Props become properties of the element. The `ctx` is in `element.vitral`.

`setup` runs on each mount and receives the remote's registry ([`ctx.customElements`](/en/aprender/estilos#custom-elements-per-remote), or the global one in older hosts). The element is created with that registry. If `setup` returns a string, it is the element's tag instead of `tag`.

## SharedController

```ts
new SharedController(host, key, select?)
```

```js
class Profile extends LitElement {
  user = new SharedController(this, 'user')
  render() {
    return html`${this.user.value?.name}`
  }
}
```

Lit controller. Subscribes while the element is connected and requests a new render when the value changes.
