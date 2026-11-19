---
title: Why vitral
description: What vitral solves, when to use it, when not to, and how to explain it to your team.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# Why vitral

In one sentence: **vitral puts micro-frontends from any framework on one page, and the host needs no build config.**

## Where it came from

vitral started in a project with several teams, each owning part of the same site.

First we used Module Federation. Every dependency change had to be agreed between builds: versions in `shared`, React singletons, the same webpack config on both sides.

Then we tried Next.js Multi-Zones. With only two micro-frontends, local development was already slow, and the config for rewrites, `assetPrefix` and environment variables grew with each new area. Switching areas reloaded the page.

vitral is what was missing: each team publishes a `vitral.json`, and the host only needs the URL.

## The problem

A micro-frontend is a part of the page (cart, search, menu) that one team builds and ships on its own. The final page, the host, puts those parts together.

The most used tools for this come at a high cost:

- **Module Federation:** the host build and each remote build have to match. React and Vue versions go into `shared` and singletons, and a wrong version breaks in production. A new deploy with a stale cache throws `ChunkLoadError`.
- **single-spa:** root config, import map, one adapter and one lifecycle per framework, before the first component shows up.
- **iframe:** isolates everything, but each part downloads its own framework, and height, routes, focus and theme have to be synced by hand.

In all of them, one team's CSS can change another team's screen, and a remote that is down can take the whole page down.

## How vitral solves it

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/como-funciona-en.png')" alt="Three teams (React, Vue, Angular) each publish a vitral.json to a CDN. The host reads the URLs with configure and mounts the three remotes on the same page.">
  <img class="so-escuro" :src="withBase('/marca/como-funciona-escuro-en.png')" alt="">
</picture>

1. **Each team** exports the component as `default` and adds `vitral()` to `vite.config`. The build writes the JS, the CSS and a `vitral.json`.
2. **Each team** deploys the `dist` folder to any CDN, whenever it wants.
3. **The host** registers the URL of each `vitral.json` with `configure()` and renders `<Remote name="cart" />`.

Underneath there is one contract: the remote exports `mount(el, props, ctx)` and returns `{ update, unmount }`. The React, Vue, Angular, Svelte, Solid, Preact and Lit adapters write that contract for you.

## What you get

| | How |
| --- | --- |
| No build on the host | The host only needs the URL. It even works with a `<script>` tag in plain HTML |
| Any framework | Host and remote don't need to match. Each remote carries its own framework, and `dedupe` avoids downloading the same one twice |
| Scoped CSS | The plugin prefixes the remote's CSS. Tailwind works. Shadow DOM with one prop |
| Isolated errors | Each remote shows its own error, with a code and a link to the fix. `retry` mounts only that remote |
| Security | Origin allowlist and SHA-384 hash checked before the JS runs |
| Typed props | The build publishes `vitral.d.ts`. A wrong prop does not compile on the host |
| Independent deploys | Hashed files; only `vitral.json` revalidates. Canary and rollback by switching a pointer |

## The numbers

From the [public benchmark](/en/aprender/benchmark), in Chromium, on Slow 4G, median of 7 visits:

<div class="vt-numeros">
  <div><b>5.1 kB</b><span>minimal host code, with brotli. Module Federation's is 19.4 kB.</span></div>
  <div><b>-58%</b><span>first-visit time compared with Module Federation with shared React.</span></div>
  <div><b>4.5x</b><span>faster to switch areas than Next.js Multi-Zones.</span></div>
  <div><b>64%</b><span>fewer bytes to open two areas than Next.js Multi-Zones.</span></div>
</div>

The [benchmark](/en/aprender/benchmark) page shows the method and the versions.

## When to use it

- Several teams ship parts of the same page, each at its own pace.
- Parts of the page use different frameworks, or are moving from one to another.
- You want to replace Module Federation, single-spa, qiankun or Next.js Multi-Zones. There is a [migration guide](/en/migracao/module-federation) for each one.
- You want to put your widget on another company's site with a `<script>` tag.

## When not to use it

- **One team, one app:** a single bundle is simpler. Use your framework's components and lazy loading.
- **Third-party code you don't trust:** Shadow DOM isolates CSS, not JS. Use an [iframe](/en/aprender/iframe).
- **First visit with no server in front:** without the SSR gateway, the host HTML arrives empty and the first paint waits for the JS. With the [gateway](/en/aprender/ssr#routes-with-ssr), the first paint matches Next.

## How to explain it to your team

**For developers:** "Each team runs `vite build` on its own component and deploys it to a CDN. The host calls `configure({ remotes })` and uses `<Remote name="cart" />`. No plugin on the host and no React version to agree on."

**For architects:** "Independent deploys per team, with CSS and errors isolated per remote, hashes checked before running, and typed props between host and remote. The minimal host is 5.1 kB."

**For managers:** "Each team ships its part of the site without waiting for the others. If one part breaks, only that part goes away, and the rest of the site stays up."

## Next step

<div class="vt-actions">
  <a class="vt-btn primary" :href="withBase('/en/aprender/configurar')">Set up host and remote</a>
  <a class="vt-btn" :href="withBase('/en/aprender/benchmark')">See the benchmark</a>
</div>

Or generate a ready host and remote with `npm create vitral@latest`.
