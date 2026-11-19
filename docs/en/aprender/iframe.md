# Iframe

Runs the remote in an iframe with `sandbox`, with no access to the host's DOM, cookies and storage.

## When to use it

For third-party or legacy code that touches `window`. For the other cases, use the default mode or Shadow DOM. To isolate only the JS and keep the DOM on the page, use [Reframe](./reframe).

## Code

```ts
import { enableIframe } from 'vitral/iframe'

enableIframe() // once, in the host
```

```html
<vitral-remote name="partner-widget" isolate="iframe" props='{"color":"blue"}'></vitral-remote>
```

```jsx
<Remote name="partner-widget" isolate="iframe" />
```

`register('x', { url, isolate: 'iframe' })` and `configure({ isolate: 'iframe' })` work too.

- The page checks origin and SRI and sends the checked JS to the iframe.
- Props, `ctx.events` and `ctx.navigate` work. Only serializable data: functions in props don't pass.
- The iframe's height follows the content.
- Inside the remote, use `ctx.events`, not `import { events } from 'vitral'`.
- [Shared context](./contexto) doesn't cross the iframe.

| `enableIframe` option | Default | What it does |
| --- | --- | --- |
| `sandbox` | `'allow-scripts'` | Value of the `sandbox` attribute. With `allow-same-origin` the iframe no longer isolates |
| `bridges` | `[]` | Extra bridges between page and iframe |

## CSP

The iframe inherits the page's CSP. Allow the hash of the iframe's script:

```ts
import { createHash } from 'node:crypto'
import { FRAME_SCRIPT } from 'vitral/iframe'

console.log(`'sha256-${createHash('sha256').update(FRAME_SCRIPT).digest('base64')}'`)
```

The hash only changes between library versions.
