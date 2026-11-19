# Lazy, prefetch and keep-alive

Controls when each remote downloads and mounts.

## When to use each

- `loading="lazy"`: a remote below the fold (comments, footer).
- `prefetch="hover"`: a remote opened by a link or button.
- `priority="high"`: a remote that shows right when the page opens.
- `keepAlive`: a remote the user opens and closes many times (tabs, routes).

## Code

```html
<!-- mounts when it is about to show on screen; reserve the space -->
<vitral-remote name="comments" loading="lazy" style="display:block;min-height:400px"></vitral-remote>
<!-- mounts when the browser is idle, but downloads on hover -->
<vitral-remote name="checkout" loading="idle" prefetch="hover"></vitral-remote>
<!-- shows right when the page opens -->
<vitral-remote name="header" priority="high"></vitral-remote>
```

```jsx
<Remote name="checkout" loading="lazy" prefetch="visible" keepAlive />
```

Download without mounting:

```ts
import { preload } from 'vitral'

link.addEventListener('pointerenter', () => preload('checkout'), { once: true })
```

`preload('checkout', { routes: true })` also downloads, while the browser is idle, the code of the remote's other routes.

| Option | Values | What it does |
| --- | --- | --- |
| `loading` | `lazy`, `idle` | Mounts 200px before it shows on screen, or when the browser is idle |
| `prefetch` | `hover`, `visible`, `idle` | Calls `preload()` before mounting |
| `priority` | `high` | High priority for the manifest, JS and CSS downloads |
| `keepAlive` (`keep-alive`) | `true` or a number | Keeps the remote when leaving the page (default: up to 5). On return it only gets the new props |

Each remote is downloaded once per page, even with several instances.

## Predictive prefetch

Preloads the remote of the route the user usually opens next:

```ts
import { prefetch } from 'vitral/prefetch'

prefetch()
```

It learns from the user's own navigations and, while the browser is idle, downloads the remote of the most likely route without running it. See [vitral/prefetch](/en/referencia/prefetch).

## Slow network and weak devices

With data saver on or a 2G network, vitral only downloads what the page uses now and stops preloading. On 3G or on low-memory devices, it cuts preloading of the other remotes. Safari and Firefox don't report these signals, so there everything is downloaded as asked. To fix the behavior:

```ts
configure({ policy: 'critical' }) // 'all', 'critical' or 'lazy'
```

## Last screen on the return visit

With `snapshot`, the remote saves the screen it showed when leaving. The next time it mounts with the same props, that screen shows right away, instead of "loading", while the JS downloads. It goes away when the remote mounts.

```ts
import { snapshots } from 'vitral/snapshot'

snapshots()
```

```tsx
<Remote name="orders" snapshot />                 // vitral/react
<vitral-remote name="orders" snapshot></vitral-remote>
```

The saved screen doesn't respond to clicks, lives in `sessionStorage` (gone when the tab closes) and comes with the remote's CSS. Call `clearSnapshots()` on logout. It doesn't work with Shadow DOM.

## Keep-alive

With keep-alive, pause timers when the remote leaves the screen:

```js
mount(el, props, ctx) {
  let timer = setInterval(tick, 1000)
  ctx.onDeactivate?.(() => clearInterval(timer))
  ctx.onActivate?.(() => (timer = setInterval(tick, 1000)))
  return { unmount: () => clearInterval(timer) }
}
```

## Timeout and retries

```ts
configure({ timeout: 15000, retries: 1 })
```

| Option | Default | What it does |
| --- | --- | --- |
| `timeout` | `15000` | Maximum time for each download, in ms |
| `retries` | `1` | New attempts for the JS on a network error or `TIMEOUT` |

## Return visit without waiting for the manifest

On the return visit, each remote waits for `vitral.json` to arrive from the network before running, even with the JS in cache. With `maxStale`, the host uses the manifest saved on the last visit, if it is up to N seconds old, and downloads the new one in the background:

```ts
configure({ maxStale: 300 }) // 5 minutes
```

The cost: a new deploy, or a [rollback](/en/aprender/canary), arrives one visit later for whoever had the saved copy.

## Compile at once (Chrome)

```ts
vitral({ compileHints: true })
```

Chrome compiles the remote's JS at once, on a background thread, instead of function by function. On phones with weak CPUs, the return visit was 10% to 14% faster in our test, with about 25% more memory. Turn it on when your audience uses weak phones and the remote shows right when the page opens.

## Metrics

```ts
configure({
  onMetric: ({ name, stage, duration }) => rum.send(`vitral.${stage}`, duration, { remote: name }),
})
```

`stage` is `manifest`, `js`, `css` or `mount`. The stages also show in the DevTools Performance tab as `vitral:<remote>:<stage>`.

LCP, CLS and INP of each remote, per route: [vitral/vitals](/en/referencia/vitals).

## CDN cache

| File | `Cache-Control` |
| --- | --- |
| `vitral.json` | `no-cache` |
| `remote-*.js`, `remote-*.css` | `public, max-age=31536000, immutable` |
