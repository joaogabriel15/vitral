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

## What you get

- **Any framework, both ways:** React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit and plain JS. Host and remote do not need to match.
- **Scoped CSS:** a remote's CSS (Tailwind included) only applies inside that remote. Shadow DOM is one prop away.
- **Isolated errors:** each remote shows its own error and can be retried alone.
- **Integrity:** with a SHA-384 hash, the remote's JS only runs if the hash matches.
- **Typed props:** the build publishes `vitral.d.ts`; `npx vitral types` makes a wrong prop fail to compile on the host.
- **Shared state and events** across remotes, keep-alive, lazy loading, prefetch, canary and rollback.

## Numbers

From the [public benchmark](https://joaogabriel15.github.io/vitral/aprender/benchmark) (Chromium, Slow 4G, median of 7 visits):

- **3.4 kB** minimal host code, brotli. Module Federation's host is 19.4 kB.
- **57% faster** first visit than Module Federation with shared React (1157 ms vs 2673 ms, 1 remote).
- **4.6× faster** switching areas than Next.js Multi-Zones (184 ms vs 850 ms).

The benchmark page also lists where vitral loses.

## Docs

The full documentation is in Portuguese: https://joaogabriel15.github.io/vitral/. Code samples read the same in any language, and the [API reference](https://joaogabriel15.github.io/vitral/referencia/) is generated from the types.

MIT license.
