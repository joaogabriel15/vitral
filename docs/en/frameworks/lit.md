# Lit and Web Components

Lit, Stencil or any Custom Element. Import: `vitral/element`.

## Today and with vitral

Example: a shop shows the cart, built in Lit by another team. Both sides have the same files, in the same order.

### Today, with the element in a script

```js
// cart/src/Cart.js
import { LitElement, html } from 'lit'

export default class Cart extends LitElement {
  static properties = { userId: {} }
  render() {
    return html`<p>Cart for user ${this.userId}</p>`
  }
}
```

```js
// cart/src/index.js
import Cart from './Cart.js'

customElements.define('my-cart', Cart)
```

```js
// cart/vite.config.js
export default {
  build: { lib: { entry: 'src/index.js', formats: ['es'], fileName: 'cart' } },
}
```

```html
<!-- shop/index.html -->
<script type="module" src="https://cdn.example.com/cart/cart.js"></script>

<my-cart userid="42"></my-cart>
```

Two cart versions can't register the same tag on the same page, and the CSS isn't isolated.

### With vitral

```js
// cart/src/Cart.js (same)
import { LitElement, html } from 'lit'

export default class Cart extends LitElement {
  static properties = { userId: {} }
  render() {
    return html`<p>Cart for user ${this.userId}</p>`
  }
}
```

```js
// cart/src/index.js (not needed anymore: the plugin registers the tag)
```

```js
// cart/vite.config.js (vitral instead of build.lib)
import vitral from 'vitral/vite'

export default {
  plugins: [vitral({ name: 'cart', entry: 'src/Cart.js' })],
}
```

```html
<!-- shop/index.html -->
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.example.com/cart/vitral.json" props='{"userId": 42}'></vitral-remote>
```

The plugin registers the tag in a registry of the remote's own. Two cart versions can be on the same page.

## Host

Use `<vitral-remote>`. It works inside a Lit component as in any HTML:

```js
import { LitElement, html } from 'lit'
import { configure } from 'vitral'
import { defineVitralElement } from 'vitral/element'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })
defineVitralElement()

class Page extends LitElement {
  render() {
    return html`
      <vitral-remote name="cart" .props=${{ userId: 42 }}>
        <p slot="fallback">Loading…</p>
      </vitral-remote>
    `
  }
}
```

Attributes, properties and events are in [Plain JS/TS](./javascript#host).

## Remote

With the plugin, exporting the class is enough. The plugin registers the tag:

```js
// src/remote.js
import { LitElement, html } from 'lit'

export default class Cart extends LitElement {
  static properties = { userId: {} }
  render() {
    return html`<button @click=${() => this.vitral.events.emit('cart:open')}>Cart for ${this.userId}</button>`
  }
}
```

```js
// vite.config.js
import vitral from 'vitral/vite'

export default { plugins: [vitral({ entry: 'src/remote.js' })] }
```

Or register the tag yourself and use `elementRemote`. `setup` receives the remote's custom elements registry:

```js
import { elementRemote } from 'vitral/element'

export default elementRemote('my-cart', (registry) => {
  if (!registry.get('my-cart')) registry.define('my-cart', Cart)
  if (!registry.get('ds-button')) registry.define('ds-button', DsButton)
})
```

In Shadow DOM, with browser support, that registry belongs only to the remote: another remote can have a `<ds-button>` of another version. The plugin also defines the exported class there. A class with `@customElement` already went into the global registry when the module loaded. See [Custom elements per remote](/en/aprender/estilos#custom-elements-per-remote).

Props become properties of the element. The `ctx` lives in `this.vitral`.

## Shared state

```js
import { SharedController } from 'vitral/element'

class Profile extends LitElement {
  user = new SharedController(this, 'user')
  render() {
    return html`${this.user.value?.name}`
  }
}
```

`SharedController(host, key, selector?)` subscribes while the element is connected. See [Shared context](/en/aprender/contexto).
