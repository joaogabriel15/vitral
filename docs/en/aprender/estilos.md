# Styles, Tailwind and theme

Each remote's CSS applies only inside it. The host doesn't need to know the remote's classes.

## When to use each mode

| Mode | How to turn it on | Remote CSS affects the host? | Host CSS affects the remote? |
| --- | --- | --- | --- |
| Scope (default) | nothing | No | Yes, whatever isn't overridden |
| Shadow DOM | `isolate="shadow"` | No | Only what inherits (font, color, CSS variables) |
| [Reframe](./reframe) | `isolate="reframe"` | No | Only what inherits (font, color, CSS variables) |
| [Iframe](./iframe) | `isolate="iframe"` | No | No |

## Scope

The plugin prefixes every selector in the remote's CSS:

```css
/* remote CSS */
.button { color: red }

/* after the build */
[data-vitral-scope="cart"] .button { color: red }
```

`:root`, `html` and `body` become the remote's root. The remote's Tailwind preflight doesn't change the host.

The CSS `<link>` stays in the document after the remote unmounts. With the scope it matches nothing outside the remote, and the next mount doesn't download or apply the CSS again.

### With `@scope`

```ts
vitral({ scopeCss: 'native' })
```

All the CSS goes into one `@scope`, with no prefix on each selector:

```css
@scope ([data-vitral-scope="cart"]) {
  .button { color: red }
}
```

`:root`, `html` and `body` become `:scope`. `@keyframes`, `@font-face` and `@property` stay outside the block. The CSS gets smaller.

Difference from the prefix: a host rule with the same selector, loaded later, applies inside the remote. Use it when the host has no loose CSS for the same classes. It needs a browser with `@scope` (Chrome 118, Safari 17.4, Firefox 146).

## Shadow DOM

```jsx
<Remote name="cart" isolate="shadow" />
```

```ts
configure({ isolate: 'shadow' }) // for every remote
```

Tailwind v4 shadows, rings, gradients and fonts work inside Shadow DOM.

## Tailwind

```js
// remote's vite.config.js
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitral from 'vitral/vite'

export default { plugins: [react(), tailwindcss(), vitral()] }
```

```css
/* src/styles.css */
@import "tailwindcss";
```

The remote ships its own CSS. Arbitrary classes like `h-[37px]` work.

## Use the host's theme

With Tailwind v4 and a tokens package used by both sides:

```css
/* @company/theme/tokens.css */
@theme {
  --color-brand: oklch(0.55 0.2 290);
}
```

```css
/* host */
@import "tailwindcss";
@import "@company/theme/tokens.css" theme(static);
```

```css
/* remote */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) theme(reference);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities);
@import "@company/theme/tokens.css" theme(reference);
```

The remote uses the host's color when it exists. Changing the brand in the host changes the remote with no new build.

Without a tokens package or without Tailwind:

```js
vitral({ theme: 'host' })
```

Every `var(--x)` in the remote uses the host's value when it exists.

## Dark mode

The variables the host switches in `.dark` reach the remote. In Shadow DOM, the library copies `class` and `data-theme` from `<html>` to the remote, so `dark:` works.

## Host CSS in Shadow DOM

```js
configure({ styles: { inherit: ['/assets/base.css'] } })
```

```html
<vitral-remote name="cart" isolate="shadow" inherit-styles="/assets/base.css"></vitral-remote>
```

## Portals (Radix, Headless UI, MUI)

Without Shadow DOM, a React remote doesn't need any change: dialogs, popovers and menus that go to `document.body` keep the remote's CSS.

In Shadow DOM, a portal in `document.body` leaves the remote and loses its CSS. Use `ctx.portalContainer`, an element inside the remote with its CSS and theme.

Radix:

```jsx
import * as Popover from '@radix-ui/react-popover'
import { usePortalContainer } from 'vitral/react'

function Help() {
  const container = usePortalContainer()
  return (
    <Popover.Root>
      <Popover.Trigger>Help</Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content>Help text</Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

The same goes for `Dialog.Portal` and `DropdownMenu.Portal`.

Headless UI: `MenuItems`, `PopoverPanel` and similar stay inside the remote if you don't use `portal` or `anchor`. Its `Dialog` always goes to `document.body`; in Shadow DOM, use another dialog.

MUI: pass `container={usePortalContainer()}` to `Menu`, `Dialog`, `Popover` and `Tooltip`, or set that `container` in the theme. MUI's CSS needs `createCache({ key: 'css', container: ctx.shadowRoot })` in a `CacheProvider`.

Vue:

```vue
<script setup>
import { usePortalContainer } from 'vitral/vue'
const portal = usePortalContainer()
</script>

<template>
  <Teleport :to="portal"><div class="menu">…</div></Teleport>
</template>
```

In other frameworks, use `ctx.portalContainer` directly.

## Custom elements per remote

Two remotes can use different versions of the same design system, each with its own `<ds-button>`. In the global registry (`customElements`), the second definition throws and the remote doesn't mount.

In Shadow DOM, each remote gets `ctx.customElements`, a registry of its own in browsers that support it (Chrome and Edge 146+, Safari 26+). Define the tags there:

```js
export default {
  mount(el, props, ctx) {
    const registry = ctx.customElements ?? customElements
    registry.define('ds-button', DsButton)
    el.innerHTML = '<ds-button>Buy</ds-button>'
    return { unmount: () => el.replaceChildren() }
  },
}
```

In other browsers, the remotes share the global registry: the first definition of each tag wins, and the console warns in dev.

## Extra CSS for a remote

```ts
configure({
  remotes: {
    cart: { url: 'https://cdn.example.com/cart/vitral.json', css: ['https://cdn.example.com/brand.css'] },
  },
})
```

## Options

In the plugin (`vitral/vite`):

| Option | Default | What it does |
| --- | --- | --- |
| `scopeCss` | `true` | Prefixes the remote's CSS. `'native'` uses `@scope`. `false` turns it off |
| `theme` | none | `'host'`: the remote's variables fall back to the host's value |
| `layers` | none | `'flatten'`: use it when the host has CSS without `@layer` (Tailwind v3, legacy CSS) that overrides the remote |
| `renameRegisteredProperties` | `false` | Use it when the host has Tailwind v3 and the remote v4. Keeps the host's gradients from breaking |

In `configure`:

| Option | Default | What it does |
| --- | --- | --- |
| `isolate` | `'none'` | Mode for every remote |
| `styles.inherit` | `[]` | Host CSS inside each Shadow DOM |
| `styles.mirrorTheme` | `true` | Copies `class` and `data-theme` from `<html>` to the Shadow DOM |
