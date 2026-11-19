# SSR

The host components work in apps with server rendering.

## When to use it

In Next, Nuxt, SvelteKit or Angular SSR.

## What happens

- On the server, the component renders the `fallback`.
- On the client, the remote mounts. There's no hydration error.
- In Next, `<Remote>` already has `'use client'`.
- In Nuxt, call `configure` in a `.client.ts` plugin.
- In Angular, `provideVitral` does nothing on the server.

## Server state on the client

On the server, each request has its own [shared context](./contexto). To send the values to the client:

```ts
import { serializeShared } from 'vitral'

const html = `<script type="application/json" data-vitral-shared>${serializeShared({ user })}</script>`
```

Put the script before the app's scripts. The first `provide` of the key on the client keeps the value that came from the server. Functions and `undefined` are left out.

| Function | What it does |
| --- | --- |
| `serializeShared(values)` | Turns `{ key: value }` into JSON safe for `<script>` |

## Remote SSR through the gateway

With the [`vitral/edge`](../referencia/edge) gateway, the remote's HTML comes ready in the response: good for SEO and for the first paint.

Besides `mount`, the remote exports:

```ts
// cart/src/server.ts (runs in the gateway)
export function render(props: { n: number }): string {
  return `<button>items: ${props.n}</button>`
}

// cart/src/index.ts (runs in the browser)
export default defineRemote({
  mount(el, props, ctx) { /* mounts from scratch */ },
  hydrate(el, props, ctx) {
    // `el` already has the HTML from `render`: only wire the events.
    const button = el.querySelector('button')!
    button.onclick = () => ctx.events.emit('cart:open')
    return { unmount: () => (el.textContent = '') }
  },
})
```

In the gateway:

```ts
import { render } from 'cart/server'

gateway({ origin, remotes: { cart: { url: 'https://cdn…/cart/vitral.json', render } }, isolate: 'shadow' })
```

The host stays the same:

```html
<vitral-remote name="cart" props='{"n":3}' isolate="shadow">
  <p slot="fallback">Loading…</p>
</vitral-remote>
```

In the browser, the remote's HTML and CSS show before any JS. With `hydrate`, the remote only wires the events on the HTML that came from the server. Without `hydrate`, it mounts the normal way and replaces the server HTML when it finishes.

In React, `reactRender` from `vitral/react-server` does the `render`, and `reactRemote` (or the plugin) already exports `hydrate`:

```ts
// cart/src/server.ts
import { reactRender } from 'vitral/react-server'
import Cart from './Cart'

export const render = reactRender(Cart)
```

If `render` fails, the page goes out without that remote's SSR and it mounts in the browser. The gateway's `onError` gets the error.

## Routes with SSR

For an app split by route between teams (the Next.js Multi-Zones case), pass the gateway the same route map as the client:

```ts
// gateway
import { gateway } from 'vitral/edge'
import { render as account } from 'account/server'
import { render as checkout } from 'checkout/server'

export default {
  fetch: gateway({
    origin: 'https://shell.example.com',
    remotes: {
      account: { url: 'https://cdn.example.com/account/vitral.json', render: account },
      checkout: { url: 'https://cdn.example.com/checkout/vitral.json', render: checkout },
    },
    routes: { '/account/*': 'account', '/checkout/*': 'checkout' },
  }),
}
```

```html
<!-- app shell, served by https://shell.example.com -->
<vitral-outlet props='{"store":"downtown"}'><p slot="fallback">Loading…</p></vitral-outlet>
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: { account: '/_vitral/account/vitral.json', checkout: '/_vitral/checkout/vitral.json' } })
  routes({ '/account/*': 'account', '/checkout/*': 'checkout' })
</script>
```

What happens:

- **First visit:** the gateway renders the URL's remote inside `<vitral-outlet>` and tells the browser to start downloading its files. The content shows before any JS.
- **Route change:** the outlet mounts the new route's remote on the client, without reloading the page and without downloading the framework again. With [`vitral/prefetch`](../referencia/prefetch), the next route's remote is already downloaded.

In the benchmark against Multi-Zones, this opens the first page 27% faster than Next and switches routes 4.5 times faster. See [Benchmark](./benchmark#against-next-js-multi-zones).
