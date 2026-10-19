---
"vitral": minor
---

Atribuição de erros por remote. Todo `RemoteError` traz `entry` (URL do JS), `version` (do `vitral.json`) e `route` (`location.pathname` no momento do erro). `configure({ onError })` recebe cada erro de qualquer remote uma vez, além do `onError` de cada montagem. `configure({ captureGlobalErrors: true })` atribui a um remote os erros sem tratamento que saem do código dele. Novos imports `vitral/sentry` (`sentryOnError(Sentry)`) e `vitral/otel` (`otelOnError({ trace, tracer })`), sem dependência dos SDKs.
