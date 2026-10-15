import { isRemoteError, RemoteError } from './errors'
import { mountRemote } from './mount'
import type { Isolation, MountedRemote, Props, StyleOptions } from './types'
import { registerSrc } from './registry'

// Controlador de slot: base dos componentes de host de qualquer framework.

export type SlotStatus = 'loading' | 'ready' | 'error'

export interface SlotOptions<P extends Props = Props> {
  /** Nome registrado. Com `src`, é o nome sob o qual a URL é registrada (opcional). */
  name?: string
  /** URL do `vitral.json` (ou do JS). Registra o remote sem `configure()`. */
  src?: string
  props?: P
  isolate?: Isolation
  /** `'high'` para o remote que aparece logo ao abrir a página. */
  priority?: RequestPriority
  /** Estilos do host no Shadow DOM (somados aos do `configure`). */
  styles?: StyleOptions
  /** Chamado a cada mudança de estado (para mostrar fallback / erro). */
  onStatus?: (status: SlotStatus, error: RemoteError | null) => void
}

export interface RemoteSlot<P extends Props = Props> {
  /** Atualiza as props sem remontar. */
  update(props: P): void
  /** Troca de remote ou de isolamento (remonta). */
  set(options: Partial<Pick<SlotOptions<P>, 'name' | 'src' | 'isolate'>>): void
  /** Remonta do zero (botão "tentar de novo"). */
  retry(): void
  destroy(): void
  readonly status: SlotStatus
}

/**
 * Cuida do ciclo de vida de um remote dentro de `target`: monta, atualiza,
 * remonta ao trocar de nome, ignora respostas atrasadas e limpa tudo no fim.
 * Os adaptadores de host (Web Component, Svelte, Solid, Preact…) usam isto.
 */
export function createSlot<P extends Props = Props>(target: HTMLElement, options: SlotOptions<P>): RemoteSlot<P> {
  let { isolate } = options
  const key = (o: Pick<SlotOptions<P>, 'name' | 'src'>) => (o.src ? registerSrc(o.src, o.name) : o.name ?? '')
  let name = key(options)
  let props = (options.props ?? {}) as P
  let handle: MountedRemote<P> | null = null
  let holder: HTMLElement | null = null
  let token = 0
  let status: SlotStatus = 'loading'

  const setStatus = (s: SlotStatus, e: RemoteError | null = null) => {
    status = s
    if (holder) holder.style.display = s === 'error' ? 'none' : ''
    options.onStatus?.(s, e)
  }

  const teardown = () => {
    handle?.unmount()
    handle = null
    holder?.remove()
    holder = null
  }

  const mount = () => {
    const my = ++token
    teardown()
    // Um elemento novo por montagem: shadow roots e DOM antigos nunca são reusados.
    holder = document.createElement('div')
    holder.setAttribute('data-vitral-slot', name)
    target.appendChild(holder)
    setStatus('loading')
    const fail = (e: unknown) => {
      if (my !== token) return
      setStatus('error', isRemoteError(e) ? e : new RemoteError('MOUNT_FAILED', name, String(e), e))
    }
    const initial = props
    mountRemote<P>(holder, name, props, { isolate, priority: options.priority, styles: options.styles, onError: fail }).then((h) => {
      if (my !== token) return h.unmount()
      handle = h
      // Props que mudaram enquanto o remote baixava.
      if (props !== initial) h.update?.(props)
      setStatus('ready')
    }, fail)
  }

  mount()
  return {
    update(next) {
      props = next
      handle?.update?.(next)
    },
    set(next) {
      const nextName = next.src || next.name !== undefined ? key(next) : name
      const changed = nextName !== name || ('isolate' in next && next.isolate !== isolate)
      name = nextName
      if ('isolate' in next) isolate = next.isolate
      if (changed) mount()
    },
    retry: mount,
    destroy() {
      token++
      teardown()
    },
    get status() {
      return status
    },
  }
}
