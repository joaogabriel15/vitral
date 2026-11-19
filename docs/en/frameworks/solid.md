# Solid

Solid 1.8 or newer. Import: `vitral/solid`.

## Today and with vitral

Example: a Solid shop shows the cart, built by another team. Both sides have the same files, in the same order.

### Today, with Module Federation

Module Federation has no Solid adapter, so the cart exposes a function that mounts the component.

```jsx
// cart/src/Cart.jsx
export default function Cart(props) {
  return <p>Cart for user {props.userId}</p>
}
```

```jsx
// cart/src/mountCart.jsx
import { render } from 'solid-js/web'
import Cart from './Cart'

export function mountCart(el, props) {
  return render(() => <Cart {...props} />, el) // returns the function that unmounts
}
```

```js
// cart/vite.config.js
import solid from 'vite-plugin-solid'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    solid(),
    federation({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: { './mountCart': './src/mountCart.jsx' },
      shared: { 'solid-js': { singleton: true } },
    }),
  ],
}
```

```js
// shop/vite.config.js
import solid from 'vite-plugin-solid'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    solid(),
    federation({
      name: 'shop',
      remotes: {
        cart: { type: 'module', name: 'cart', entry: 'https://cdn.example.com/cart/remoteEntry.js' },
      },
      shared: { 'solid-js': { singleton: true } },
    }),
  ],
}
```

```jsx
// shop/src/Page.jsx
import { onCleanup, onMount } from 'solid-js'

export function Page() {
  let el
  onMount(async () => {
    const { mountCart } = await import('cart/mountCart')
    onCleanup(mountCart(el, { userId: 42 }))
  })
  return <div ref={el} />
}
```

### With vitral

```jsx
// cart/src/Cart.jsx (same)
export default function Cart(props) {
  return <p>Cart for user {props.userId}</p>
}
```

```jsx
// cart/src/mountCart.jsx (not needed anymore: the plugin mounts the component)
```

```js
// cart/vite.config.js (vitral instead of federation)
import solid from 'vite-plugin-solid'
import vitral from 'vitral/vite'

export default {
  plugins: [
    solid(),
    vitral({ name: 'cart', entry: 'src/Cart.jsx' }),
  ],
}
```

```js
// shop/vite.config.js (without federation)
import solid from 'vite-plugin-solid'

export default {
  plugins: [solid()],
}
```

```jsx
// shop/src/Page.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/solid'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function Page() {
  return <Remote name="cart" props={{ userId: 42 }} fallback={<p>Loading…</p>} />
}
```

Changing `props` updates the cart without remounting it. Loading and error in [Host](#host).

## Host

```jsx
import { createSignal } from 'solid-js'
import { configure } from 'vitral'
import { Remote } from 'vitral/solid'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

function App() {
  const [userId] = createSignal(42)
  return (
    <Remote
      name="cart"
      props={{ userId: userId() }}
      fallback={<p>Loading…</p>}
      error={(error, retry) => <button onClick={retry}>Try again</button>}
    />
  )
}
```

Without `error`, "Could not load." with a "Try again" button shows up (in Portuguese when the page is `pt`; change it with `configure({ messages })`). `error={null}` shows nothing.

`<Remote>` props are the same as in [React](./react#host).

## Remote

```jsx
// src/remote.jsx
import { solidRemote } from 'vitral/solid'

function Cart(props) {
  return <button onClick={() => props.vitral.events.emit('cart:open')}>Cart for {props.userId}</button>
}

export default solidRemote(Cart)
```

```js
// vite.config.js
import solid from 'vite-plugin-solid'
import vitral from 'vitral/vite'

export default { plugins: [solid(), vitral({ entry: 'src/remote.jsx' })] }
```

The `ctx` arrives in the `vitral` prop.

## Shared state

```jsx
import { useShared } from 'vitral/solid'

const name = useShared('user', (u) => u?.name) // accessor
return <p>{name()}</p>
```

See [Shared context](/en/aprender/contexto).
