---
layout: page
title: vitral
titleTemplate: Micro-frontends from any framework
---

<script setup>
import { withBase } from 'vitepress'
</script>

<div class="vp-doc vt-home">

<div class="vt-hero">
  <img :src="withBase('/logo.svg')" alt="" width="112" height="112">
  <h1>vitral</h1>
  <p class="vt-tagline">Made of parts. Seen as a whole.</p>
  <p class="vt-desc">Micro-frontends with any framework, with no build config on the host.</p>
  <div class="vt-actions">
    <a class="vt-btn primary" :href="withBase('/en/aprender/configurar')">Get started</a>
    <a class="vt-btn" :href="withBase('/en/por-que')">Why vitral</a>
  </div>
</div>

<div class="vt-wide">

<div class="vt-numeros">
  <div><b>5.1 kB</b><span>minimal host code, with brotli</span></div>
  <div><b>-58%</b><span>first-visit time compared with Module Federation with shared React</span></div>
  <div><b>4.5x</b><span>faster to switch areas than Next.js Multi-Zones</span></div>
  <div><b>10</b><span>frameworks, as host and as remote</span></div>
</div>

<p class="vt-fonte">Measured in Chromium on Slow 4G, median of 7 visits. <a :href="withBase('/en/aprender/benchmark')">Method</a>.</p>

</div>

<div class="vt-wide">

## How it works

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/como-funciona-en.png')" alt="Three teams (React, Vue, Angular) each publish a vitral.json to a CDN. The host reads the URLs with configure and mounts the three remotes on the same page.">
  <img class="so-escuro" :src="withBase('/marca/como-funciona-escuro-en.png')" alt="">
</picture>

Each team ships its own part of the page with `vite build`. The host gets the URL of each part and mounts everything in the browser. [Why vitral](/en/por-que) explains when to use it and when not to.

</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-cobalto)"></span>The host only needs the URL

Today, with Module Federation, the host has a build plugin with `remotes` and `shared`. With vitral, register the URL of each remote's `vitral.json` and render. No plugin in the host build.

</div>
<div>

```js
// Today, with Module Federation: the host's webpack.config.js
new ModuleFederationPlugin({
  remotes: { cart: 'cart@https://cdn.example.com/cart/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```jsx
// With vitral: no build plugin
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: { cart: 'https://cdn.example.com/cart/vitral.json' },
})

export const App = () => <Remote name="cart" props={{ userId: 42 }} />
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-esmeralda)"></span>The remote is a regular component

Export the component as `default` and add the plugin. The build writes `vitral.json`.

</div>
<div>

```js
// vite.config.js
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral()] }
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-ambar)"></span>Any framework

React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit and plain JS. Host and remote don't need to match.

</div>
<div>

```vue
<template>
  <VitralRemote name="cart" :props="{ userId }">
    <template #fallback>Loading…</template>
  </VitralRemote>
</template>
```

```html
<vitral-remote name="cart" props='{"userId": 42}'></vitral-remote>
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-rubi)"></span>Scoped CSS

Each remote's CSS applies only inside it. Tailwind works. To isolate the host's CSS too, use Shadow DOM.

</div>
<div>

```css
/* remote CSS */
.button { color: red }

/* after the build */
[data-vitral-scope="cart"] .button { color: red }
```

```jsx
<Remote name="cart" isolate="shadow" />
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-cobalto)"></span>A failing remote doesn't take the page down

Each remote shows its own error. `retry` mounts only that remote again.

</div>
<div>

```jsx
<Remote
  name="cart"
  fallback={<p>Loading…</p>}
  error={(error, retry) => <button onClick={retry}>Try again</button>}
  onError={(error) => log(error.code)}
/>
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-esmeralda)"></span>Small

The minimal host code is 5.1 kB with brotli. With no build on the host, one script tag is enough.

</div>
<div>

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.example.com/cart/vitral.json"></vitral-remote>
```

</div>
</div>

<div class="vt-wide">

## Comparison

| | Module Federation | single-spa | qiankun | Next.js Multi-Zones | vitral |
| --- | --- | --- | --- | --- | --- |
| Host setup | Build plugin | Root config and import map | `registerMicroApps` and `start` | One Next app per zone plus rewrites | `configure({ remotes })` |
| Frameworks | Agree on dependencies in `shared` | One adapter per framework | Any, with an HTML entry | Next only | Any |
| CSS isolation | None | None | Shadow DOM or prefix | Per page | Automatic scope or Shadow DOM |
| Host code (brotli) | 19.4 kB | 5.8 kB | 37.9 kB | Next runtime in each zone | 5.1 kB |
| Switching areas | No reload | No reload | No reload | Full page reload | No reload |
| Checks the JS hash (SRI) | Not by default | Not by default | Not by default | Not by default | Yes, when the manifest has a hash |

Comparison with each tool's default setup. Plugins and extra configuration can change these values.

Coming from one of these tools? See [Migration](/en/migracao/module-federation).

</div>

<div class="vt-cta">

## Start now

<div class="vt-actions">
  <a class="vt-btn primary" :href="withBase('/en/aprender/configurar')">Set up host and remote</a>
  <a class="vt-btn" href="https://github.com/joaogabriel15/vitral">GitHub</a>
</div>

</div>

</div>
