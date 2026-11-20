# Svelte

Svelte 5 and SvelteKit. Import: `vitral/svelte`.

## Today and with vitral

Example: a Svelte shop shows the cart, built by another team. Both sides have the same files, in the same order.

### Today, with Module Federation

Module Federation has no Svelte adapter, so the cart exposes a function that mounts the component.

```svelte
<!-- cart/src/Cart.svelte -->
<script>
  let { userId } = $props()
</script>

<p>Cart for user {userId}</p>
```

```js
// cart/src/mountCart.js
import { mount, unmount } from 'svelte'
import Cart from './Cart.svelte'

export function mountCart(el, props) {
  const app = mount(Cart, { target: el, props })
  return () => unmount(app)
}
```

```js
// cart/vite.config.js
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    svelte(),
    federation({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: { './mountCart': './src/mountCart.js' },
      shared: { 'svelte': { singleton: true } },
    }),
  ],
}
```

```js
// shop/vite.config.js
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    svelte(),
    federation({
      name: 'shop',
      remotes: {
        cart: { type: 'module', name: 'cart', entry: 'https://cdn.example.com/cart/remoteEntry.js' },
      },
      shared: { 'svelte': { singleton: true } },
    }),
  ],
}
```

```svelte
<!-- shop/src/Page.svelte -->
<script>
  import { onMount } from 'svelte'

  let el
  onMount(() => {
    let unmountCart
    import('cart/mountCart').then(({ mountCart }) => (unmountCart = mountCart(el, { userId: 42 })))
    return () => unmountCart?.()
  })
</script>

<div bind:this={el}></div>
```

### With vitral

```svelte
<!-- cart/src/Cart.svelte (same) -->
<script>
  let { userId } = $props()
</script>

<p>Cart for user {userId}</p>
```

```js
// cart/src/mountCart.js (not needed anymore: the plugin mounts the component)
```

```js
// cart/vite.config.js (vitral instead of federation)
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vitral from 'vitral/vite'

export default {
  plugins: [
    svelte(),
    vitral({ name: 'cart', entry: 'src/Cart.svelte' }),
  ],
}
```

```js
// shop/vite.config.js (without federation)
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default {
  plugins: [svelte()],
}
```

```svelte
<!-- shop/src/Page.svelte -->
<script>
  import { configure } from 'vitral'
  import { remote } from 'vitral/svelte'

  configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })
</script>

<div use:remote={{ name: 'cart', props: { userId: 42 } }}></div>
```

Changing `props` updates the cart without remounting it. Loading and error in [Host](#host).

## Host

Use the `remote` action:

```svelte
<script>
  import { configure } from 'vitral'
  import { remote } from 'vitral/svelte'

  configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

  let userId = $state(42)
  let status = $state('loading')
</script>

<div use:remote={{ name: 'cart', props: { userId }, onStatus: (s) => (status = s) }}></div>

{#if status === 'loading'}<p>Loading…</p>{/if}
{#if status === 'error'}<p>Unavailable</p>{/if}
```

In SvelteKit the action only runs on the client.

| Parameter | Type | What it does |
| --- | --- | --- |
| `name` | `string` | Name registered in `configure` |
| `src` | `string` | URL of `vitral.json`. No `configure` needed |
| `props` | `object` | Remote props |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolation |
| `onStatus` | `(status, error) => void` | `'loading'`, `'ready'` or `'error'` |
| `loading` | `'lazy' \| 'idle'` | When to mount |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Download before mounting |
| `priority` | `'high'` | High priority for the downloads |
| `keepAlive` | `boolean \| number` | Keeps the remote mounted when leaving the page |
| `waitFor` | `string \| string[]` | `provide` keys that must have a value before mounting. See [Waiting for the session](/en/aprender/contexto#waiting-for-the-session) |

## Remote

```svelte
<!-- src/Cart.svelte -->
<script>
  let { userId, vitral } = $props()
</script>

<button onclick={() => vitral.events.emit('cart:open', userId)}>Cart for {userId}</button>
```

```js
// vite.config.js
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vitral from 'vitral/vite'

export default { plugins: [svelte(), vitral({ entry: 'src/Cart.svelte' })] }
```

Or with the explicit adapter: `export default svelteRemote(Cart)`.

The `ctx` arrives in the `vitral` prop.

## Shared state

`shared()` follows Svelte's store contract:

```svelte
<script>
  import { shared } from 'vitral'
  const theme = shared('theme')
</script>

<p>{$theme}</p>
<button onclick={() => theme.set('dark')}>Dark</button>
```

See [Shared context](/en/aprender/contexto).
