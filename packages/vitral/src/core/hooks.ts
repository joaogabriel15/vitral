import type { RemoteError } from './errors'
import type { SharedApi } from './shared'
import type { SlotStatus } from './slot'

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
  /** `heal` de `updates` para o `captureGlobalErrors` (sem import estático, que levaria o loader para o capture). */
  heal?: (name: string, error: unknown) => void
  /** Última montagem de `name` saiu da página (`watchLeaks` de `vitral/devtools`). */
  gone?: (name: string) => void
  /** Snapshot da última tela (`vitral/snapshot`), ligado por `snapshots()`. */
  snapshot?: (target: HTMLElement, name: string, props: () => unknown, box: () => HTMLElement | undefined, onSnapshot?: (shown: boolean) => void) => (status?: SlotStatus) => void
} = {}
