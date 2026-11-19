# vitral/sentry and vitral/otel

Adapters that generate an `onError` for `configure`. They don't depend on the SDKs: they receive the objects as parameters.

```ts
sentryOnError(sentry: SentryLike): (error: RemoteError) => void
otelOnError(options: { trace?, tracer? }): (error: RemoteError) => void
```

## vitral/sentry

```ts
import * as Sentry from '@sentry/browser'
import { configure } from 'vitral'
import { sentryOnError } from 'vitral/sentry'

configure({ onError: sentryOnError(Sentry) })
```

Calls `sentry.captureException(error, { tags, extra })`:

| Tag | Value |
| --- | --- |
| `vitral.remote` | `error.remote` |
| `vitral.version` | `error.version` (only when present) |
| `vitral.code` | `error.code` |

`extra` carries `entry`, `route` and `docs`.

## vitral/otel

```ts
import { trace } from '@opentelemetry/api'
import { configure } from 'vitral'
import { otelOnError } from 'vitral/otel'

configure({ onError: otelOnError({ trace, tracer: trace.getTracer('host') }) })
```

| Option | What it does |
| --- | --- |
| `trace` | `trace` from `@opentelemetry/api`. With an active span, the error becomes an `exception` event on it |
| `tracer` | Without an active span, opens a `vitral.error` span, calls `recordException`, sets the status to error and closes it |

Attributes: `exception.type`, `exception.message`, `exception.stacktrace`, `vitral.remote`, `vitral.version`, `vitral.code`, `vitral.entry` and `vitral.route`. Missing ones are left out.

## Notes

- Web Vitals per remote: [vitral/vitals](/en/referencia/vitals). This package's `otelVitals` records the vitals as histograms.
- Both only receive the errors that reach `configure`'s `onError`. See [Error handling](/en/aprender/erros#attribution-and-global-onerror).
