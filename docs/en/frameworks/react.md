# React

React 18 and 19. Import: `vitral/react`.

## Today and with vitral

Example: a React shop shows the cart, built by another team. Both sides have the same files, in the same order.

### Today, with Module Federation

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

### With vitral

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

Full guide: [Migrate from Module Federation](/en/migracao/module-federation).

## Host

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function App() {
  const [userId, setUserId] = useState(42)
  return (
    <Remote
      name="cart"
      props={{ userId, onCheckout: (order) => console.log(order) }}
      fallback={<p>Loading…</p>}
      error={(error, retry) => <button onClick={retry}>Try again</button>}
      onError={(error) => console.error(error.code)}
    />
  )
}
```

Changing `props` updates the remote. Changing `name`, `src` or `isolate` remounts it.

| Prop | Type | What it does |
| --- | --- | --- |
| `name` | `string` | Name registered in `configure` |
| `src` | `string` | URL of `vitral.json`. No `configure` needed |
| `props` | `object` | Remote props. Functions work too |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolation. See [Styles](/en/aprender/estilos) and [Iframe](/en/aprender/iframe) |
| `fallback` | `ReactNode` | Shown while loading |
| `error` | `ReactNode` or `(error, retry) => ReactNode` | Shown if it fails. Without it, a default message with a "try again" button (in Portuguese). `null` shows nothing |
| `onError` | `(error) => void` | Called on each error |
| `className` | `string` | Class of the element that receives the remote |
| `loading` | `'lazy' \| 'idle'` | When to mount. See [Loading](/en/aprender/carregamento) |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Download before mounting |
| `priority` | `'high'` | High priority for the downloads |
| `keepAlive` | `boolean \| number` | Keeps the remote mounted when leaving the page |

## Remote

With the plugin, the `export default` is enough:

```jsx
// src/App.jsx
export default function Cart({ userId }) {
  return <p>Cart for {userId}</p>
}
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

Or use the explicit adapter:

```jsx
import { reactRemote } from 'vitral/react'
import Cart from './Cart'

export default reactRemote(Cart)
```

Render errors go to the host's `error`.

## Context, events and state in the remote

```jsx
import { useVitral, useEvent, useEventValue, useShared } from 'vitral/react'

function Cart() {
  const ctx = useVitral()                       // the remote's context, or null outside it
  const total = useEventValue('cart:total')     // latest value emitted
  useEvent('cart:cleared', () => alert('Empty'))
  const name = useShared('user', (u) => u?.name)
  return <button onClick={() => ctx?.navigate('/checkout')}>{name}: {total}</button>
}
```

| Hook | What it does |
| --- | --- |
| `useVitral()` | Returns the remote's `ctx` |
| `useEvent(type, fn)` | Subscribes to an event while the component exists |
| `useEventValue(type)` | Latest value of an event. Re-renders on every `emit` |
| `useShared(key, selector?)` | Value from the [shared context](/en/aprender/contexto) |

## The host's React in the remotes

`<Remote>` offers the host's React. Remotes with `dedupe: ['react']` use that copy when the version fits. See [Dedupe](/en/aprender/dedupe).
