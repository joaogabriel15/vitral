# Error handling

A remote that fails shows its own error. The rest of the page keeps working.

## When to use it

In every host: define what to show when a remote fails.

## Code

```jsx
<Remote
  name="cart"
  error={(error, retry) => <button onClick={retry}>Try again</button>}
  onError={(error) => log(error.code, error.remote)}
/>
```

```html
<vitral-remote name="cart">
  <p slot="error">Unavailable</p>
</vitral-remote>
<script>
  document.querySelector('vitral-remote').addEventListener('vitral-error', (e) => log(e.detail.error.code))
</script>
```

Every error is a `RemoteError`:

| Field | What it is |
| --- | --- |
| `code` | Error code. See the [list](/en/erros/) |
| `remote` | Remote name |
| `docs` | Link to the code's page, with cause and fix |

`retry` mounts only that remote again.

## In the remote

In React and Vue, render errors go to the host. In the others, tell the host:

```ts
mount(el, props, ctx) {
  try {
    draw(el, props)
  } catch (error) {
    ctx.reportError(error)
  }
  return { unmount() {} }
}
```

## Attribution and global `onError`

Every `RemoteError` says which remote it came from and what state the page was in:

| Field | What it is |
| --- | --- |
| `remote` | Remote name |
| `version` | The `version` field of `vitral.json`. The Vite plugin fills it with the version in the remote's `package.json` |
| `entry` | URL of the remote's JS. If the error happened before the manifest, the registered URL |
| `route` | `location.pathname` when the error happened |

To send the errors of every remote to monitoring, pass `onError` to `configure`:

```ts
configure({
  remotes: { cart: 'https://cdn.example.com/cart/vitral.json' },
  onError(error) {
    monitoring.send(error, { remote: error.remote, version: error.version, route: error.route })
  },
})
```

The `configure` `onError` gets each error once: download failure, `TIMEOUT`, `INTEGRITY`, `mount` failure and render errors sent by `ctx.reportError`. The `onError` of each mount (`<Remote onError>`, `mountRemote(..., { onError })`) is still called. An error that goes through both arrives once in each.

### Sentry

`vitral/sentry` calls `Sentry.captureException` with the tags `vitral.remote`, `vitral.version` and `vitral.code`. It doesn't depend on the SDK: it receives the Sentry object.

```ts
import * as Sentry from '@sentry/browser'
import { configure } from 'vitral'
import { sentryOnError } from 'vitral/sentry'

configure({ onError: sentryOnError(Sentry) })
```

### OpenTelemetry

`vitral/otel` records an `exception` event on the active span. With no active span, it opens a `vitral.error` span with the `tracer` and records the error there. It doesn't depend on `@opentelemetry/api`: it receives `trace` and `tracer`.

```ts
import { trace } from '@opentelemetry/api'
import { configure } from 'vitral'
import { otelOnError } from 'vitral/otel'

configure({ onError: otelOnError({ trace, tracer: trace.getTracer('host') }) })
```

### Unhandled errors

An error the remote doesn't catch reaches the window's `error` or `unhandledrejection`, with no remote name. With `captureGlobalErrors`, vitral finds out from the error's file which remote threw it and hands it to `onError` as a `RENDER_FAILED` of that remote:

```ts
configure({ onError: sentryOnError(Sentry), captureGlobalErrors: true })
```

If there's no way to know which remote the error came from, it goes on to the page's normal handling.
