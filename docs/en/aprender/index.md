# Quick start

This page shows all of vitral in a few minutes. The next pages explain each part.

## What you will learn

- What a remote is and what a host is
- How to publish a remote
- How to show a remote in the host
- How to pass props and listen to events

## Remote and host

A **remote** is a component published to a CDN. The **host** is the page that shows the remotes. The host only needs the URL of each remote's `vitral.json`.

```
host (React)              remote (Vue)
configure({ remotes })    vite build → dist/vitral.json
<Remote name="cart">      ← downloads and mounts the remote
```

Example: a React shop shows the cart, built by another team. Both sides have the same files, in the same order.

## Today, with Module Federation

```jsx
// cart/src/Cart.jsx
export default function Cart({ userId }) {
  return <p>Cart for user {userId}</p>
}
```

```js
// cart/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: { './Cart': './src/Cart.jsx' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
}
```

```js
// shop/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shop',
      remotes: { cart: 'cart@https://cdn.example.com/cart/remoteEntry.js' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
}
```

```jsx
// shop/src/App.jsx
import { lazy, Suspense } from 'react'

const Cart = lazy(() => import('cart/Cart'))

export function App() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Cart userId={42} />
    </Suspense>
  )
}
```

## The same app with vitral

```jsx
// cart/src/Cart.jsx (same)
export default function Cart({ userId }) {
  return <p>Cart for user {userId}</p>
}
```

```js
// cart/vite.config.js (instead of webpack.config.js)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [
    react(),
    vitral({ name: 'cart', entry: 'src/Cart.jsx', dedupe: ['react'] }),
  ],
}
```

```js
// shop/webpack.config.js (without ModuleFederationPlugin)
module.exports = {
  plugins: [],
}
```

```jsx
// shop/src/App.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function App() {
  return <Remote name="cart" props={{ userId: 42 }} fallback={<p>Loading…</p>} />
}
```

`vite build` in the cart writes the JS, the CSS and `vitral.json`. Changing `props` updates the cart without remounting it.

The cart doesn't have to be React: with `vue()` instead of `react()` and a `Cart.vue`, the shop stays the same.

## No build on the host

On any HTML page:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js" data-origins="https://cdn.example.com"></script>

<vitral-remote src="https://cdn.example.com/cart/vitral.json"></vitral-remote>
```

## The contract

Every remote, in any framework, is a module with `mount`:

```ts
export default {
  mount(el, props, ctx) {
    el.textContent = `Hello, ${props.name}`
    return {
      update(next) { el.textContent = `Hello, ${next.name}` },
      unmount() { el.textContent = '' },
    }
  },
}
```

Each framework's adapter builds this object for you.
