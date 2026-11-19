# Migrate from Next.js Multi-Zones

In Multi-Zones, each team has a Next app (a zone) with part of the URLs, and rewrites put everything together on one domain. Switching zones reloads the page and downloads React and Next again. In vitral, each zone becomes a remote, the [`vitral/edge`](/en/referencia/edge) gateway plays the role of the rewrites and renders the route on the server, and an app shell switches routes without reloading.

## Equivalents

| Multi-Zones | vitral |
| --- | --- |
| One Next app per zone | One remote per area, with its own deploy |
| `rewrites` (or `proxy.js`) in the main app | `gateway({ routes })` in front of the app shell |
| Each zone's `assetPrefix` | `/_vitral/<name>/`, set by the gateway |
| HTML rendered by the zone | The remote's `render` in the gateway (`reactRender` in React) |
| Next hydration | The remote's `hydrate` (`reactRemote` already has it) |
| `<a>` between zones, with a page reload | Links intercepted by `routes()`, no reload |
| React and Next downloaded again in each zone | One copy of React for every remote, with [`dedupe`](/en/aprender/dedupe) |
| Speculation Rules (Chromium only) for the next zone | [`vitral/prefetch`](/en/referencia/prefetch), in any browser |
| Route of a single zone | Route of a single remote (`routes`) |

## Step by step

### 1. The zone's page becomes a remote

```jsx
// account/src/Account.jsx: the component the zone's page.jsx rendered
export default function Account({ user }) { /* … */ }
```

```js
// account/vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/Account.jsx', name: 'account', dedupe: ['react'] })] }
```

The plugin wraps the `export default` with `reactRemote`, which already knows how to hydrate.

### 2. The remote exports the server `render`

```ts
// account/src/server.ts
import { reactRender } from 'vitral/react-server'
import Account from './Account'

export const render = reactRender(Account)
```

### 3. The gateway replaces the rewrites

```ts
import { gateway } from 'vitral/edge'
import { render as account } from 'account/server'
import { render as shop } from 'shop/server'

export default {
  fetch: gateway({
    origin: 'https://shell.example.com',
    remotes: {
      account: { url: 'https://cdn.example.com/account/vitral.json', render: account },
      shop: { url: 'https://cdn.example.com/shop/vitral.json', render: shop },
    },
    routes: { '/account/*': 'account', '/*': 'shop' },
  }),
}
```

### 4. The app shell

```html
<vitral-outlet><p slot="fallback">Loading…</p></vitral-outlet>
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'
  import { prefetch } from 'vitral/prefetch'

  configure({ remotes: { account: '/_vitral/account/vitral.json', shop: '/_vitral/shop/vitral.json' } })
  routes({ '/account/*': 'account', '/*': 'shop' })
  prefetch()
</script>
```

Inside each area, the remote can have its own router with the route base. See [Routes](/en/aprender/rotas#with-the-host-s-router).

## Without a gateway: the main Next app as host

If the main app is already Next and the zones don't need SSR, the zones become remotes right inside it, with no gateway:

1. Each zone builds with `vitral({ next: { basePath } })`, without changing its Next code. See [Code written for Next](/en/frameworks/next#code-written-for-next).
2. The main app replaces the rewrites with `withVitral` and gets one page per zone with `<NextRemote>`. See [Next host instead of zones](/en/frameworks/next#next-host-instead-of-zones).
3. Links and `location.assign` to the zone's routes now switch areas without reloading (`VitralNext`).

## What doesn't migrate

- **Next server features inside the zone:** Server Components, Server Actions, `getServerSideProps`, `next/image` and middleware. The remote's `render` is a `renderToString` of the component: server data comes in as props (the outlet's `props` attribute) or is fetched on the client.
- **Next host with remote SSR:** in a Next app as host, `<Remote>` and `<NextRemote>` render the `fallback` on the server and mount on the client. SSR through the gateway applies to the app shell without a framework.

## Numbers

In the [benchmark](/en/aprender/benchmark#against-next-js-multi-zones), with two areas and a slow network, vitral with the gateway opens the first page faster than Multi-Zones, switches areas 4.5 times faster and downloads 64% less.
