/**
 * Erros dos remotes no OpenTelemetry, sem depender do `@opentelemetry/api`:
 *
 *   import { trace } from '@opentelemetry/api'
 *   import { otelOnError } from 'vitral/otel'
 *
 *   configure({ onError: otelOnError({ trace, tracer: trace.getTracer('host') }) })
 *
 * Com um span ativo, o erro vira um evento `exception` nele. Sem span ativo
 * (ou sem `trace`), o `tracer` abre e fecha um span `vitral.error` com o erro.
 * Os atributos são os de exceção do OpenTelemetry mais `vitral.remote`,
 * `vitral.version`, `vitral.code`, `vitral.entry` e `vitral.route`.
 */
import type { RemoteError } from './core/errors'

/** Atributos de span e de evento. */
export type Attributes = Record<string, string>

/** A parte de um `Span` que o adaptador usa. */
export interface SpanLike {
  addEvent(name: string, attributes?: Attributes): unknown
  recordException(exception: Error): void
  setStatus(status: { code: number; message?: string }): unknown
  end(): void
}

export interface OtelOptions {
  /** O `trace` de `@opentelemetry/api`, para achar o span ativo. */
  trace?: { getActiveSpan(): SpanLike | undefined }
  /** Tracer que abre um span quando não há span ativo. */
  tracer?: { startSpan(name: string, options?: { attributes?: Attributes }): SpanLike }
}

/** `onError` para o `configure` que registra cada `RemoteError` no OpenTelemetry. */
export function otelOnError({ trace, tracer }: OtelOptions): (error: RemoteError) => void {
  return (error) => {
    const all: Record<string, string | undefined> = {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
      'vitral.remote': error.remote,
      'vitral.version': error.version,
      'vitral.code': error.code,
      'vitral.entry': error.entry,
      'vitral.route': error.route,
    }
    const attributes: Attributes = {}
    for (const k in all) if (all[k] !== undefined) attributes[k] = all[k]
    const active = trace?.getActiveSpan()
    if (active) return void active.addEvent('exception', attributes)
    const span = tracer?.startSpan('vitral.error', { attributes })
    if (!span) return
    span.recordException(error)
    // 2 = SpanStatusCode.ERROR.
    span.setStatus({ code: 2, message: error.message })
    span.end()
  }
}
