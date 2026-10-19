/**
 * Erros dos remotes no Sentry, sem depender do SDK:
 *
 *   import * as Sentry from '@sentry/browser'
 *   import { sentryOnError } from 'vitral/sentry'
 *
 *   configure({ onError: sentryOnError(Sentry) })
 *
 * Cada `RemoteError` vira um `captureException` com as tags `vitral.remote`,
 * `vitral.version` e `vitral.code`, e com `entry`, `route` e `docs` no `extra`.
 */
import type { RemoteError } from './core/errors'

/** A parte do SDK do Sentry que o adaptador usa (`@sentry/browser`, `@sentry/react`…). */
export interface SentryLike {
  captureException(exception: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): unknown
}

/** `onError` para o `configure` que manda cada `RemoteError` ao Sentry. */
export function sentryOnError(sentry: SentryLike): (error: RemoteError) => void {
  return (error) => {
    const tags: Record<string, string> = { 'vitral.remote': error.remote, 'vitral.code': error.code }
    if (error.version) tags['vitral.version'] = error.version
    sentry.captureException(error, { tags, extra: { entry: error.entry, route: error.route, docs: error.docs } })
  }
}
