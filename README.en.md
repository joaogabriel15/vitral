<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/banner-escuro.png">
    <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/banner.png" width="640" alt="vitral">
  </picture>
</p>

<p align="center"><strong>Micro-frontends from any framework on one page. No build config on the host.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/vitral"><img src="https://img.shields.io/npm/v/vitral" alt="npm"></a>
  <a href="https://github.com/joaogabriel15/vitral/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/vitral" alt="MIT license"></a>
  · <a href="./README.md">Português</a>
</p>

Each team ships its own part of the page (a remote) with `vite build`. The host gets the URL of each remote and mounts them in the browser. No plugin on the host, no React version to agree on between teams, and a remote that is down does not take the page down.

**Why use it:**

- **Any framework, both ways:** React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit and plain JS. Host and remote do not need to match.
- **Scoped CSS:** a remote's CSS (Tailwind included) only applies inside that remote. Shadow DOM is one prop away.
- **Isolated errors:** each remote shows its own error and can be retried alone.
- **Integrity:** with a SHA-384 hash, the remote's JS only runs if the hash matches.
- **Typed props:** the build publishes `vitral.d.ts`; `npx vitral types` makes a wrong prop fail to compile on the host.
- **Shared state and events** across remotes, keep-alive, lazy loading, prefetch, canary and rollback.

```bash
npm install vitral
```

<p align="center">
  <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/como-funciona.png" width="900" alt="Three teams (React, Vue, Angular) each publish a vitral.json to a CDN. The host reads the URLs with configure and mounts the three remotes on the same page.">
</p>

## Quick start

`npm create vitral@latest` scaffolds a host and a remote.

**Remote:** export your component and add the plugin.

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

`vite build` outputs the JS, the CSS and a `vitral.json`. Deploy `dist` to any CDN with CORS.

**Host:** register the URL and render.

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export const App = () => <Remote name="cart" props={{ userId: 42 }} fallback={<p>Loading…</p>} />
```

No build at all, in any HTML page:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>
<vitral-remote src="https://cdn.example.com/cart/vitral.json"></vitral-remote>
```

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

## Local and Docker

Locally, each remote runs its own `vite dev` on a port and the host points at those ports. With Docker, each remote is an nginx image and the host reads its remote list from an environment variable, so one image works in every environment. Full example: [`examples/docker`](https://github.com/joaogabriel15/vitral/tree/main/examples/docker).

## Docs

The full documentation is in Portuguese: https://joaogabriel15.github.io/vitral/. Code samples read the same in any language, and the [API reference](https://joaogabriel15.github.io/vitral/referencia/) is generated from the types.

MIT license. Made by [Pacheco Codes](https://pacheco.dev.br/).
