---
title: Brand
description: vitral's logo, colors, name and copy to use in posts, talks and documentation.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# Brand

Everything you need to talk about vitral in a post, a talk or your project's README. The files are in [`docs/public/marca`](https://github.com/joaogabriel15/vitral/tree/main/docs/public/marca) and are free to use. Files ending in `-en.png` are the English versions.

## Name

**vitral**, always lowercase, even at the start of a sentence. The npm package has the same name: `vitral`.

## Tagline and description

| Use | Text |
| --- | --- |
| Tagline | Made of parts. Seen as a whole. |
| One line | Micro-frontends from any framework on one page, with no build config on the host. |
| One paragraph | Each team ships its own part of the page with `vite build`. The host gets the URL of each part and mounts everything in the browser. There is no plugin on the host, no React version for teams to agree on, and a part that is down does not take the page down. |
| In Portuguese | Feito de partes. Visto como um todo. |

When you quote numbers, use the ones from the [benchmark](/en/aprender/benchmark) with the conditions they were measured in (Chromium, Slow 4G, median of 7 visits) and a link to the page.

## Logo

<div class="vt-marca-logos">
  <div class="claro"><img :src="withBase('/logo.svg')" alt="vitral logo on a light background" width="120" height="120"></div>
  <div class="escuro"><img :src="withBase('/logo.svg')" alt="vitral logo on a dark background" width="120" height="120"></div>
</div>

- File: [`logo.svg`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/logo.svg).
- Leave clear space around it of at least 1/4 of the logo's width.
- Minimum size: 24 px.
- Don't change the colors, don't rotate it, don't add shadows or outlines.

## Colors

<div class="vt-marca-cores">
  <div style="--c:#2563eb"><b>Cobalt</b><code>#2563eb</code></div>
  <div style="--c:#059669"><b>Emerald</b><code>#059669</code></div>
  <div style="--c:#d97706"><b>Amber</b><code>#d97706</code></div>
  <div style="--c:#e11d48"><b>Ruby</b><code>#e11d48</code></div>
  <div style="--c:#161b26"><b>Lead</b><code>#161b26</code></div>
</div>

The four colors appear together, in this order, in the strip under the site's top bar and at the top of the images. Lead is the background of the dark theme and of the sharing image. In the logo, the glass pieces use lighter tones of the same colors (`#3b82f6`, `#10b981`, `#f59e0b`, `#f43f5e`) and the center is violet (`#8b5cf6`).

## Typography

[Inter](https://rsms.me/inter/) for text, weight 800 for the name and 600 for the tagline. [JetBrains Mono](https://www.jetbrains.com/lp/mono/) for code.

## Ready-made images

| File | Size | Use |
| --- | --- | --- |
| [`og-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/og-en.png) | 1200x630 | Link previews (site, GitHub, social networks) |
| [`banner-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/banner-en.png) and [`banner-escuro-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/banner-escuro-en.png) | 2560x640 | Top of READMEs and posts |
| [`como-funciona-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/como-funciona-en.png) and [`como-funciona-escuro-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/como-funciona-escuro-en.png) | 2400x986 | Diagram of teams, CDN and host |
| [`multizonas-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/multizonas-en.png) and [`multizonas-escuro-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/multizonas-escuro-en.png) | 2400 wide | Multi-Zones and vitral side by side |
| [`dedupe-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/dedupe-en.png) and [`dedupe-escuro-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/dedupe-escuro-en.png) | 2400 wide | Shared dependencies |
| [`comunicacao-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/comunicacao-en.png) and [`comunicacao-escuro-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/comunicacao-escuro-en.png) | 2400 wide | Events and context between remotes |
| [`seguranca-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/seguranca-en.png) and [`seguranca-escuro-en.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/seguranca-escuro-en.png) | 2400 wide | Origin, hash and blocking |

<img :src="withBase('/marca/og-en.png')" alt="vitral sharing image" style="border-radius:8px;margin-top:16px">

The images come from [`docs/scripts/marca/pecas.html`](https://github.com/joaogabriel15/vitral/blob/main/docs/scripts/marca/pecas.html). To change a text, edit the HTML (the English strings are in the `textos` table at the end) and run `pnpm --dir docs marca`.
