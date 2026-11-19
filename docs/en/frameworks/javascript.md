# Plain JS and TypeScript

No framework. Import: `vitral` and `vitral/element`.

## Today and with vitral

Example: a shop shows the cart, built by another team. Both sides have the same files, in the same order.

### Today, with an iframe

```js
// cart/src/Cart.js
const draw = (userId) => {
  document.getElementById('app').innerHTML = `<p>Cart for user ${userId}</p>`
}

draw(new URLSearchParams(location.search).get('userId'))
window.addEventListener('message', (e) => {
  if (e.origin === 'https://shop.example.com') draw(e.data.userId)
})
```

```js
// cart/vite.config.js
export default {}
```

```html
<!-- shop/index.html -->
<iframe id="cart" src="https://cart.example.com/?userId=42" style="width: 100%; height: 400px; border: 0"></iframe>

<script>
  const cart = document.getElementById('cart')
  // change the user
  cart.contentWindow.postMessage({ userId: 43 }, 'https://cart.example.com')
</script>
```

The cart runs a whole app inside the iframe, with a fixed height and without the page's CSS.

### With vitral

```js
// cart/src/Cart.js (receives props instead of reading the URL and messages)
import { component, html } from 'vitral'

export default component(({ userId }) => html`<p>Cart for user ${userId}</p>`)
```

```js
// cart/vite.config.js
import vitral from 'vitral/vite'

export default {
  plugins: [vitral({ name: 'cart', entry: 'src/Cart.js' })],
}
```

```html
<!-- shop/index.html -->
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js" data-origins="https://cdn.example.com"></script>

<vitral-remote id="cart" src="https://cdn.example.com/cart/vitral.json" props='{"userId": 42}'></vitral-remote>

<script type="module">
  const cart = document.getElementById('cart')
  // change the user
  cart.props = { userId: 43 }
</script>
```

The cart mounts on the page, with the content's height. If you need full isolation, `isolate="iframe"` is still available: see [Iframe](/en/aprender/iframe).

## Host

### No build

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js" data-origins="https://cdn.example.com"></script>

<vitral-remote src="https://cdn.example.com/cart/vitral.json"></vitral-remote>
```

`data-origins` lists, separated by spaces, the origins the `src` values can come from. A `<vitral-remote src>` with another origin, injected into the HTML (a comment, a profile field), runs nothing. On `localhost` you don't need it.

In a project with a bundler, `import 'vitral/auto'` defines `<vitral-remote>`, and the origins come from `configure({ allowedOrigins })` or `configure({ remotes })`.

### With `configure`

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

```js
const el = document.querySelector('vitral-remote')
el.props = { userId: 43 }   // updates without remounting
el.retry()                  // mounts again
el.status                   // 'loading' | 'ready' | 'error'
el.addEventListener('vitral-ready', (e) => console.log(e.detail.timings))
el.addEventListener('vitral-error', (e) => console.log(e.detail.error.code))
```

The `props` attribute only accepts JSON. To pass functions, use the `el.props` property.

| Attribute | What it does |
| --- | --- |
| `name` | Name registered in `configure` |
| `src` | URL of `vitral.json`. No `configure` needed |
| `props` | Props as JSON |
| `isolate` | `none`, `shadow` or `iframe` |
| `loading` | `lazy` or `idle` |
| `prefetch` | `hover`, `visible` or `idle` |
| `priority` | `high` |
| `keep-alive` | Keeps the remote mounted when leaving the page. Accepts the maximum kept |
| `inherit-styles` | Host CSS inside the Shadow DOM, separated by spaces |

| Slot | When it shows |
| --- | --- |
| `fallback` | While loading |
| `error` | If it fails |

Without the slots, the element shows a default loading and error screen, with a try again button.

### Without a component

`createSlot` mounts a remote in any element:

```ts
import { createSlot } from 'vitral'

const slot = createSlot(document.querySelector('#cart')!, {
  name: 'cart',
  props: { userId: 42 },
  onStatus(status, error) {
    if (error) console.log(error.code)
  },
})

slot.update({ userId: 43 })
slot.set({ name: 'cart-v2' }) // remounts
slot.retry()
slot.destroy()
```

To mount once, without state: `await mountRemote(el, 'cart', { userId: 42 })` returns `{ update, unmount }`.

## Remote

### With `component` and `html`

```ts
// src/remote.ts
import { component, html } from 'vitral'

export default component<{ name: string }>({
  state: { clicks: 0 },
  render: ({ name }, state, ctx) => html`
    <p>Hello, ${name}</p>
    <button onclick=${() => state.clicks++}>clicks: ${state.clicks}</button>
  `,
  mounted(el, state, ctx) {
    const timer = setInterval(() => state.clicks++, 1000)
    return () => clearInterval(timer)
  },
})
```

Without state, the function is enough:

```ts
export default component(({ name }) => html`<p>Hello, ${name}</p>`)
```

- Everything inside `${}` is escaped.
- Changing `state` or receiving new props renders again.
- `on<event>=${fn}` becomes a listener.
- `unsafeHTML(text)` inserts HTML without escaping. Use it only with trusted HTML.
- `mounted` runs after the first render. The returned function runs on unmount.

### With the contract directly

```ts
import { defineRemote } from 'vitral'

export default defineRemote<{ name: string }>({
  mount(el, props, ctx) {
    el.textContent = `Hello, ${props.name}`
    return {
      update: (next) => (el.textContent = `Hello, ${next.name}`),
      unmount: () => el.replaceChildren(),
    }
  },
})
```

`mount` can be `async`. `update` is optional. This is the contract every adapter generates.

```js
// vite.config.js
import vitral from 'vitral/vite'

export default { plugins: [vitral({ entry: 'src/remote.ts' })] }
```

## The `ctx`

Every remote receives the same `ctx`:

| Field | What it is |
| --- | --- |
| `name` | Name the host registered the remote with |
| `baseUrl` | URL of the JS folder. Use it to build URLs for images and files |
| `events` | Event bus. What the remote subscribes to through it is cancelled on unmount |
| `shared` | Shared context. See [Context](/en/aprender/contexto) |
| `shadowRoot` | The shadow root, with `isolate="shadow"`. Otherwise `null` |
| `portalContainer` | Where to render popovers and dialogs. See [Portals](/en/aprender/estilos#portals-radix-headless-ui-mui) |
| `customElements` | The remote's custom elements registry. See [Custom elements per remote](/en/aprender/estilos#custom-elements-per-remote) |
| `navigate(url, { replace? })` | Navigates the page and notifies every router |
| `reportError(error)` | Shows the error in the host |
| `onActivate(fn)`, `onDeactivate(fn)` | With keep-alive. See [Loading](/en/aprender/carregamento#keep-alive) |
