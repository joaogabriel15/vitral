<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/banner-escuro-en.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/banner-en.png" width="640" alt="vitral. Made of parts. Seen as a whole.">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/joaogabriel15/vitral/actions/workflows/ci.yml"><img src="https://github.com/joaogabriel15/vitral/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/vitral"><img src="https://img.shields.io/npm/v/vitral" alt="npm"></a>
  <a href="https://bundlejs.com/?q=vitral"><img src="https://img.shields.io/bundlejs/size/vitral" alt="size"></a>
  <a href="https://github.com/joaogabriel15/vitral/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/vitral" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://joaogabriel15.github.io/vitral/">Docs (Portuguese)</a> ·
  <a href="https://joaogabriel15.github.io/vitral/aprender/benchmark">Benchmark</a> ·
  <a href="./README.md">Português</a>
</p>

Micro-frontends with any framework, with no build config on the host. React, Next.js, Vue, Nuxt, Angular, Svelte and more on one page.

**What it is:** a micro-frontend is a part of the page that one team builds and ships on its own, like the cart, the search or the account area. vitral puts those parts together on one page, even when each one uses a different framework.

**How it works:** each team builds its part (a *remote*) with `vite build` and deploys it to a CDN. The main page (the *host*) gets the URL of each remote and mounts them in the browser.

**Why use it:**

- **Zero host config.** No build plugin: just `configure({ remotes })` with the URL of each remote.
- **Any framework.** React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit and plain JS on the same page. No React version to agree on between teams.
- **Independent deploys.** Each team ships when it wants. The host picks up the new version without a new build.
- **Isolated CSS and errors.** A remote's CSS does not change the rest of the page. A remote that is down shows its own error, and the rest keeps working.
- **Secure.** The JS only runs if it comes from an allowed origin and its SHA-384 hash matches.
- **Small and fast.** 5.1 kB of host code. Opens the page in half the time of Module Federation and switches areas 4.5 times faster than Next.js Multi-Zones.

**When to use it:** when several teams work on the same site and each wants to ship at its own pace. With one team and one app, a regular bundle is simpler.

```bash
npm install vitral
```

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/como-funciona-escuro-en.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/como-funciona-en.png" width="900" alt="Three teams (React, Vue, Angular) each publish a vitral.json to a CDN. The host reads the URLs with configure and mounts the three remotes on the same page.">
  </picture>
</p>

## Comparison

| | Module Federation | single-spa | Next.js Multi-Zones | vitral |
|---|---|---|---|---|
| Host config | Build plugin, matched with each remote | Root config and import map | One Next app per zone, plus rewrites | None. Just `configure()` |
| Frameworks | Agree on versions in `shared` | One adapter and lifecycle per framework | Next only | Any, no versions to agree on |
| Splits the page into | Parts | Apps per route | Routes (each zone is a page) | Parts or routes |
| Switching areas | No reload | No reload | Reloads the page and downloads Next and React again | No reload |
| CSS isolation | None | None | Per page | Automatic scope or Shadow DOM |
| Remote is down | An unhandled error takes the page down | The error screen is up to you | The whole zone is down | Only that remote shows an error, with `retry` |
| Host code (brotli) | 19.4 kB | 5.8 kB | Next runtime in each zone | 5.1 kB |

## Speed

Measured in Chromium on a slow mobile network (Slow 4G). Median of 7 visits. Lower is better.

**Against Module Federation**, with React shared between remotes:

| | vitral | Module Federation |
|---|--:|--:|
| Open the page with 1 remote | **1.1 s** | 2.6 s |
| Open the page with 8 remotes | **2.1 s** | 4.5 s |
| Downloaded with 8 remotes | **153 kB** | 409 kB |

**Against Next.js Multi-Zones**, with the app split into two areas:

| | vitral | Multi-Zones |
|---|--:|--:|
| Open the first area | **0.7 s** | 1.0 s |
| Switch areas | **0.2 s** | 0.8 s |
| Downloaded to open both areas | **83 kB** | 229 kB |

The minimal host code is 5.1 kB with brotli. [How it was measured](https://joaogabriel15.github.io/vitral/aprender/benchmark): versions, machine and the script to run it again.

## Quick start

`npm create vitral@latest` scaffolds a host and a remote.

**1. In the remote**, export your component and add the plugin:

```jsx
// src/App.jsx (or .vue, .svelte, .tsx…)
export default function Cart({ userId }) { … }
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

`vite build` outputs the JS, the CSS and a `vitral.json`. Deploy `dist` to any CDN.

**2. In the host**, register the URL and render the remote:

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function App() {
  return <Remote name="cart" props={{ userId: 42 }} fallback={<p>Loading…</p>} />
}
```

That's it. Changing `props` updates the remote without remounting.

In any HTML page, with no build:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>
<vitral-remote src="https://cdn.example.com/cart/vitral.json"></vitral-remote>
```

## Frameworks

| Framework | Remote | Host | Import |
|---|---|---|---|
| React 18/19 | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Next.js (App and Pages Router) | `reactRemote(App)` | `<Remote>` | `vitral/react` |
| Vue 3 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Nuxt 3/4 | `vueRemote(App, { setup })` | `<VitralRemote>` | `vitral/vue` |
| Angular 17+ | `angularRemote(Component, { providers })` | `<vitral-remote>` + `provideVitral()` | `vitral/angular` |
| Svelte 5 | `svelteRemote(App)` | `use:remote` | `vitral/svelte` |
| Solid | `solidRemote(App)` | `<Remote>` | `vitral/solid` |
| Preact | `preactRemote(App)` | `<Remote>` | `vitral/preact` |
| Lit and Web Components | `elementRemote('my-widget')` | `<vitral-remote>` | `vitral/element` |
| Plain JS and TypeScript | `component({ render })` | `<vitral-remote>` | `vitral` |

Host and remote do not need to use the same framework.

## Next.js and Nuxt as host

The remote is always a Vite project (React, Vue or another), as in the quick start above. The host can be a Next or Nuxt app.

**Next.js (App Router):**

```tsx
// app/cart.tsx
'use client'
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

if (typeof window !== 'undefined') {
  configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })
}

export function Cart({ userId }: { userId: number }) {
  return <Remote name="cart" props={{ userId }} fallback={<p>Loading…</p>} />
}
```

```tsx
// app/page.tsx
import { Cart } from './cart'

export default function Page() {
  return <main><Cart userId={42} /></main>
}
```

**Nuxt 3 and 4:**

```ts
// app/plugins/vitral.client.ts
import { configure } from 'vitral'

export default defineNuxtPlugin(() => {
  configure({ remotes: { catalog: 'https://cdn.example.com/catalog/vitral.json' } })
})
```

```vue
<!-- app/pages/index.vue -->
<script setup lang="ts">
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="catalog" :props="{ userId: 42 }">
    <template #fallback><p>Loading…</p></template>
  </VitralRemote>
</template>
```

In both, the server renders the `fallback` and the remote mounts in the browser. No `dynamic(..., { ssr: false })` or `<ClientOnly>` needed.

## Multi-Zones or vitral

The same Next app split into two areas: the shop (main app) and the account area, owned by another team.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/multizonas-escuro-en.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/multizonas-en.png" width="900" alt="Left, Multi-Zones: two Next apps, rewrites, and the page reloads when switching areas (0.8 s). Right, vitral: one Next app with withVitral, the account area is a remote inside its layout, and switching needs no reload (0.2 s).">
  </picture>
</p>

**With Multi-Zones**, the account area is a second Next app, and the main app proxies its URLs to it:

```js
// account/next.config.js (the zone)
module.exports = {
  basePath: '/account',
  assetPrefix: '/account-static',
}
```

```js
// shop/next.config.js (the main app)
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
// links between zones: <a>, not <Link>. The page reloads and downloads Next and React again.
<a href="/account">My account</a>
```

**With vitral**, the account area is a remote (a Vite project) and the shop stays the only Next app:

```js
// account/vite.config.js (the remote)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ name: 'account', dedupe: ['react'] })] }
```

```js
// shop/next.config.js (the host)
const { withVitral } = require('vitral/next-config')

module.exports = withVitral({}, {
  remotes: {
    account: { url: 'https://cdn.example.com/account/vitral.json', basePath: '/account' },
  },
})
```

```tsx
// shop/pages/_app.tsx
import { VitralNext } from 'vitral/next-host'

export default function App({ Component, pageProps }) {
  return <><VitralNext /><Component {...pageProps} /></>
}
```

```tsx
// shop/pages/account/[[...slug]].tsx
import { NextRemote } from 'vitral/next-host'

export default function Account() {
  return <Layout><NextRemote name="account" fallback={<p>Loading…</p>} /></Layout>
}
```

```tsx
// links: a regular <Link>. No reload, and React is not downloaded again.
<Link href="/account">My account</Link>
```

| | Multi-Zones | vitral |
|---|---|---|
| Next apps | One per area | Only the host |
| Config | `basePath` and `assetPrefix` in the zone, `rewrites` in the main app | `withVitral` in the host, plugin in the remote |
| Switch areas | Reloads the page (0.8 s in the benchmark) | No reload (0.2 s) |
| React and Next | Downloaded again in each area | One copy for the whole page |
| Main app layout | Each zone repeats its own | The remote sits inside the host layout |

Full guide, with per-route SSR and prefetch: [Migrate from Next.js Multi-Zones](https://joaogabriel15.github.io/vitral/migracao/multi-zones) (in Portuguese).

## What else comes with it

**Shared dependencies.** With `vitral({ dedupe: ['react'] })`, the remote uses the React already on the page instead of downloading another copy.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/dedupe-escuro-en.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/dedupe-en.png" width="900" alt="Without dedupe, each remote downloads its own React. With dedupe, remotes use the React already on the page when the version fits; one that doesn't fit loads its own.">
  </picture>
</p>

**Communication between remotes.** `events` sends messages between remotes, and `provide` and `shared` hold common state, like the signed-in user.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/comunicacao-escuro-en.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/comunicacao-en.png" width="900" alt="Three remotes in React, Vue and Angular. The cart emits an event, the search receives it on the same bus, and the account reads the user the host created with provide.">
  </picture>
</p>

**Security.** The JS only runs if it comes from an allowed origin and, with `integrity`, if the hash matches.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/seguranca-escuro-en.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/seguranca-en.png" width="900" alt="The host sets allowedOrigins and integrity. Before running, the library checks the origin and the SHA-384. If either fails, nothing runs and the error shows in place of the remote.">
  </picture>
</p>

Also:

- **CSS and Tailwind:** each remote's CSS only applies inside it, or use Shadow DOM with `isolate="shadow"`.
- **Loading:** `loading="lazy"`, `prefetch="hover"` and `keepAlive` to open and come back faster.
- **Errors:** every error has a code and a page with the cause and the fix, and `retry` mounts only that remote again.
- **Typed props:** `npx vitral types` makes a wrong prop fail to compile on the host.
- **Routes, SSR and deploys:** app shell per route, the remote's HTML from the server, canary and rollback.
- **Tests:** `mockRemote` and `failingRemote` test the host without the network.

## Local and Docker

Each remote runs its own `vite dev` on a port, and the host points at those ports:

```json
// shop/public/remotes.json
{
  "cart": "http://localhost:5174/vitral.json",
  "search": "http://localhost:5175/vitral.json"
}
```

```js
// shop/src/main.jsx
configure({ remotes: '/remotes.json' })
```

Editing a remote updates the host without a page reload. With Docker, each remote is an nginx image and the host reads its remote list from an environment variable, so one image works in every environment. Full example: [`examples/docker`](https://github.com/joaogabriel15/vitral/tree/main/examples/docker).

## Links

- [Docs](https://joaogabriel15.github.io/vitral/): guides, reference and error pages, in Portuguese. Code samples read the same in any language.
- [Examples](https://github.com/joaogabriel15/vitral/tree/main/examples): the same remote in 8 frameworks and 9 hosts.
- [Contributing](https://github.com/joaogabriel15/vitral/blob/main/CONTRIBUTING.md)
- [MIT](https://github.com/joaogabriel15/vitral/blob/main/LICENSE) license. Made by [Pacheco Codes](https://pacheco.dev.br/).
