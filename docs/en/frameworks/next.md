<script setup>
import { withBase } from 'vitepress'
</script>

# Next.js

App Router and Pages Router. Import: `vitral/react`.

## Next host instead of zones

In a Next app (Pages Router) as host, `vitral/next-config` and `vitral/next-host` do what the Multi-Zones rewrites did, without reloading the page when switching areas.

Example: a Next.js shop with the "My account" area, built by another team. Both sides have the same files, in the same order. With vitral, the shop gets one new file at the end.

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/multizonas-en.png')" alt="On the left, Multi-Zones: two Next apps, rewrites, and the page reloads when switching areas (0.8 s). On the right, vitral: one Next app with withVitral, the account is a remote inside the layout and switching has no reload (0.2 s).">
  <img class="so-escuro" :src="withBase('/marca/multizonas-escuro-en.png')" alt="">
</picture>

### Today, with Multi-Zones

```
shop/      main Next app
account/   second Next app (the zone)
```

```tsx
// account/pages/index.tsx
export default function Account() {
  return <h1>My account</h1>
}
```

```js
// account/next.config.js
module.exports = {
  basePath: '/account',
  assetPrefix: '/account-static',
}
```

```js
// shop/next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: '/account', destination: `${process.env.ACCOUNT_URL}/account` },
      { source: '/account/:path+', destination: `${process.env.ACCOUNT_URL}/account/:path+` },
      { source: '/account-static/:path+', destination: `${process.env.ACCOUNT_URL}/account-static/:path+` },
    ]
  },
}
```

```tsx
// shop/pages/_app.tsx
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

```tsx
// shop/components/Menu.tsx
// <a>, not <Link>: the page reloads and downloads Next and React again.
<a href="/account">My account</a>
```

### With vitral

```
shop/      Next app (the host)
account/   the same code, built with Vite (the remote)
```

```tsx
// account/pages/index.tsx (same)
export default function Account() {
  return <h1>My account</h1>
}
```

```js
// account/vite.config.js (instead of next.config.js)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [
    react(),
    vitral({ name: 'account', entry: 'pages/index.tsx', next: { basePath: '/account' }, dedupe: ['react'] }),
  ],
}
```

```js
// shop/next.config.js (withVitral instead of the rewrites)
const { withVitral } = require('vitral/next-config')

module.exports = withVitral({}, {
  remotes: {
    account: { url: 'https://cdn.example.com/account/vitral.json', basePath: '/account' },
  },
})
```

```tsx
// shop/pages/_app.tsx (plus <VitralNext />)
import { VitralNext } from 'vitral/next-host'

export default function App({ Component, pageProps }) {
  return <><VitralNext /><Component {...pageProps} /></>
}
```

```tsx
// shop/components/Menu.tsx
// <Link>: switching has no reload, and React doesn't download again.
<Link href="/account">My account</Link>
```

```tsx
// shop/pages/account/[[...slug]].tsx (new file: the shop page that shows the account)
import { NextRemote } from 'vitral/next-host'

export default function Account() {
  return <NextRemote name="account" fallback={<p>Loading…</p>} />
}
```

With `next: { basePath }`, the account code can keep using `next/link` and `useRouter`.

Done. A `<Link href="/account">` in the shop opens the remote without reloading, and inside the remote `useRouter`, `<Link>` and `router.push` use the host's router. A plain `<a>` to a remote route also becomes navigation without reload.

| Remote option | Default | What it does |
| --- | --- | --- |
| `url` | required | URL of `vitral.json` |
| `basePath` | required | Host page that shows the remote |
| `routes` | none | `{ public, zone }`: other URLs that open the remote, like the Multi-Zones rewrites |
| `preload` | `'idle'` | `'idle'` downloads when the browser is idle, `'route'` only when the route opens, `false` never ahead |
| `devUrl` | none | In `next dev`, the remote's dev server, with HMR |
| `manifestFile` | `public/` + `url` | Path of `vitral.json` on disk, when the remote is served by another server |

`share` offers other dependencies to the remotes with [`dedupe`](/en/aprender/dedupe). They only download when a remote asks for them. Works with webpack and with Turbopack.

### Remote in the page HTML

When the remote's `vitral.json` is available at host build time, the HTML of the remote's page goes out with a preload of its JS and CSS, with the hash of each file. The remote downloads together with the host's JS, not after it.

`<VitralNext />` in `_app` adds the preload, based on the open route. That's why it also works on a page that only draws `NextRemote` in the browser, after login, for example.

In Safari, the manifest `fetch` doesn't use the preload and asks for `vitral.json` again, answered by the HTTP cache when the server allows it. JS and CSS use the preload normally.

Build the remote before the host. If the remote publishes without a new host build, the preload points to the old files and the remote still loads correctly, just a bit later. To avoid that, read the manifest on the server.

### Manifest read on the server

With `vitral/next-server`, the page reads `vitral.json` on each request. The preload always points to the version published now:

```tsx
// pages/account/[[...slug]].tsx
import { NextRemote } from 'vitral/next-host'
import { remoteProps } from 'vitral/next-server'

export const getServerSideProps = async () => ({ props: await remoteProps('account') })

export default function Account({ vitral }) {
  return <Layout><NextRemote name="account" manifest={vitral.account} /></Layout>
}
```

Also pass `pageProps` to `VitralNext`, so the preload of a page that only draws the remote after login comes from the version published now:

```tsx
// pages/_app.tsx
<VitralNext pageProps={pageProps} />
```

The server caches the manifest for a few seconds. If the remote doesn't answer, the page goes on as without it. It also works in `getStaticProps` with `revalidate`.

### Remote SSR

With `ssr`, the host's server also renders the remote. The content shows before any JS, and the browser only hydrates:

```tsx
// account/src/server.tsx (in the remote)
import { reactRender } from 'vitral/react-server'
import Account from './Account'

export const render = reactRender(Account, { state: (props) => fetchOrders(props.user) })
```

```tsx
// pages/account/[[...slug]].tsx (in the host)
import { render } from 'account/server'

const props = { user: 42 }
export const getServerSideProps = async () => ({ props: await remoteProps('account', { ssr: { account: { render, props } } }) })

export default function Account({ vitral, vitralSsr }) {
  return <NextRemote name="account" manifest={vitral.account} ssr={vitralSsr?.account} props={props} />
}
```

- `state` fetches the data on the server, and the remote reads it with `useInitialState()` without fetching again in the browser.
- If `render` fails or takes more than 3 s, the page mounts the remote in the browser, as without SSR.
- The `NextRemote` `props` must be the same as on the server.
- The remote can't use `window`, `document` or `localStorage` in the first render. Move that code to `useEffect`.
- If the host's layout only shows the page after something in the browser (like client-side auth), SSR doesn't help.

## Host with App Router

To show a remote on an App Router page. `<Remote>` already has `'use client'`. On the server it renders the `fallback`. On the client it mounts the remote. No need for `dynamic(..., { ssr: false })`.

```tsx
// app/remotes.tsx
'use client'
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

if (typeof window !== 'undefined') {
  configure({ remotes: '/remotes.json' })
}

export function Cart({ userId }: { userId: number }) {
  return <Remote name="cart" props={{ userId }} fallback={<p>Loading…</p>} />
}
```

```tsx
// app/page.tsx (server component)
import { Cart } from './remotes'

export default function Page() {
  return <main><Cart userId={42} /></main>
}
```

```json
// public/remotes.json
{ "cart": "https://cdn.example.com/cart/vitral.json" }
```

`<Remote>` props are the same as in [React](./react#host).

## Server state on the client

To send values from the [shared context](/en/aprender/contexto) from the server to the client, use `serializeShared`:

```tsx
import { serializeShared } from 'vitral'

<script
  type="application/json"
  data-vitral-shared
  dangerouslySetInnerHTML={{ __html: serializeShared({ user }) }}
/>
```

See [SSR](/en/aprender/ssr).

## Remote

A remote is not a Next app. Create the remote as a [React](./react#remote) project with Vite and use it in the Next host.

### Code written for Next

To build with Vite code that already uses `next/link`, `next/router` and friends (a Multi-Zones zone, for example), turn on `next` in the plugin:

```ts
// vite.remote.config.ts
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [react(), vitral({ entry: 'src/remote.tsx', name: 'account', next: { basePath: '/account' }, dedupe: ['react'] })],
}
```

| What `next` mode does | Detail |
| --- | --- |
| `next/link`, `next/image`, `next/head`, `next/dynamic`, `next/router`, `next/navigation` | Come from `vitral/next`. Inside a Next host (`NextRemote`), they use the host's router |
| `process.env` | `NODE_ENV` and the `NEXT_PUBLIC_*` from the environment and `.env` |
| tsconfig `paths` | Each file uses the nearest tsconfig, including one from a package published as source. Also applies in the `vite dev` pre-bundle |
| `import Icon from './icon.svg'` | React component, with the project's SVGR. Without SVGR installed, it stays a URL |

| `next` option | Default | What it does |
| --- | --- | --- |
| `basePath` | `''` | The `basePath` of the zone's `next.config` |
| `tsconfigPaths` | `true` | Resolves tsconfig `paths` |
| `svgr` | `true` | `.svg` as a component |

What `next` mode doesn't cover: Server Components, Server Actions, `getServerSideProps`, API routes and middleware. Server data comes in as props or is fetched on the client.

## Coming from Multi-Zones

To replace the zones with remotes, with per-route SSR and route switching without reload, see [Migrate from Next.js Multi-Zones](/en/migracao/multi-zones).
