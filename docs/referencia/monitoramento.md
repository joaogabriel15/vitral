# vitral/sentry e vitral/otel

Adaptadores que geram um `onError` para o `configure`. Não dependem dos SDKs: recebem os objetos por parâmetro.

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

Chama `sentry.captureException(erro, { tags, extra })`:

| Tag | Valor |
| --- | --- |
| `vitral.remote` | `erro.remote` |
| `vitral.version` | `erro.version` (só quando existe) |
| `vitral.code` | `erro.code` |

`extra` leva `entry`, `route` e `docs`.

## vitral/otel

```ts
import { trace } from '@opentelemetry/api'
import { configure } from 'vitral'
import { otelOnError } from 'vitral/otel'

configure({ onError: otelOnError({ trace, tracer: trace.getTracer('host') }) })
```

| Opção | O que faz |
| --- | --- |
| `trace` | `trace` de `@opentelemetry/api`. Com span ativo, o erro vira um evento `exception` nele |
| `tracer` | Sem span ativo, abre um span `vitral.error`, chama `recordException`, marca o status como erro e fecha |

Atributos: `exception.type`, `exception.message`, `exception.stacktrace`, `vitral.remote`, `vitral.version`, `vitral.code`, `vitral.entry` e `vitral.route`. Os ausentes ficam de fora.

## Observações

- Web Vitals por remote: [vitral/vitals](/referencia/vitals). O `otelVitals` deste pacote grava as vitals como histogramas.
- Os dois só recebem os erros que chegam ao `onError` do `configure`. Veja [Tratamento de erros](/aprender/erros#atribuicao-e-onerror-global).
