# Preact

Preact 10 or newer. Import: `vitral/preact`.

## Today and with vitral

Example: a Preact shop shows the cart, built by another team. Both sides have the same files, in the same order.

### Today, with Module Federation

Module Federation has no Preact adapter, so the cart exposes a function that mounts the component.

```jsx
// cart/src/Cart.jsx
export default function Cart({ userId }) {
  return <p>Cart for user {userId}</p>
}
```

```jsx
// cart/src/mountCart.jsx
import { render } from 'preact'
import Cart from './Cart'

export function mountCart(el, props) {
  render(<Cart {...props} />, el)
  return () => render(null, el)
}
```

```js
// cart/vite.config.js
import preact from '@preact/preset-vite'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    preact(),
    federation({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: { './mountCart': './src/mountCart.jsx' },
      shared: { 'preact': { singleton: true } },
    }),
  ],
}
```

```js
// shop/vite.config.js
import preact from '@preact/preset-vite'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    preact(),
    federation({
      name: 'shop',
      remotes: {
        cart: { type: 'module', name: 'cart', entry: 'https://cdn.example.com/cart/remoteEntry.js' },
      },
      shared: { 'preact': { singleton: true } },
    }),
  ],
}
```

```jsx
// shop/src/Page.jsx
import { useEffect, useRef } from 'preact/hooks'

export function Page() {
  const el = useRef(null)
  useEffect(() => {
    let unmountCart
    import('cart/mountCart').then(({ mountCart }) => (unmountCart = mountCart(el.current, { userId: 42 })))
    return () => unmountCart?.()
  }, [])
  return <div ref={el} />
}
```

### With vitral

```jsx
// cart/src/Cart.jsx (same)
export default function Cart({ userId }) {
  return <p>Cart for user {userId}</p>
}
```

```jsx
// cart/src/mountCart.jsx (not needed anymore: the plugin mounts the component)
```

```js
// cart/vite.config.js (vitral instead of federation)
import preact from '@preact/preset-vite'
import vitral from 'vitral/vite'

export default {
  plugins: [
    preact(),
    vitral({ name: 'cart', entry: 'src/Cart.jsx' }),
  ],
}
```

```js
// shop/vite.config.js (without federation)
import preact from '@preact/preset-vite'

export default {
  plugins: [preact()],
}
```

```jsx
// shop/src/Page.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/preact'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function Page() {
  return <Remote name="cart" props={{ userId: 42 }} fallback={<p>Loading…</p>} />
}
```

Changing `props` updates the cart without remounting it. Loading and error in [Host](#host).

## Host

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/preact'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function App() {
  return (
    <Remote
      name="cart"
      props={{ userId: 42 }}
      fallback={<p>Loading…</p>}
      error={(error, retry) => <button onClick={retry}>Try again</button>}
    />
  )
}
```

Without `error`, a default message with a "try again" button shows up (in Portuguese). `error={null}` shows nothing.

`<Remote>` props are the same as in [React](./react#host).

## Remote

```jsx
// src/remote.jsx
import { preactRemote } from 'vitral/preact'

function Cart({ userId, vitral }) {
  return <button onClick={() => vitral.events.emit('cart:open')}>Cart for {userId}</button>
}

export default preactRemote(Cart)
```

```js
// vite.config.js
import preact from '@preact/preset-vite'
import vitral from 'vitral/vite'

export default { plugins: [preact(), vitral({ entry: 'src/remote.jsx' })] }
```

The `ctx` arrives in the `vitral` prop.

## Shared state

```jsx
import { useShared } from 'vitral/preact'

const name = useShared('user', (u) => u?.name)
```

See [Shared context](/en/aprender/contexto).
