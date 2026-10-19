import type { RemoteError } from './errors'
import type { SharedApi } from './shared'

/**
 * Partes opcionais que se ligam ao `ctx` do remote só quando entram no
 * bundle, para o host mínimo não pagar por elas. O store preenche `shared` na
 * primeira vez que é usado nesta cópia da lib.
 */
export const ctxHooks: {
  shared?: (name: string, track: (off: () => void) => () => void) => SharedApi
  /**
   * Canal (`core/channel.ts`): recebe cada montagem (sem `error`) e cada
   * erro entregue ao `onError`, para contar os erros da versão canary.
   */
  watch?: (name: string, error?: RemoteError) => void
} = {}
