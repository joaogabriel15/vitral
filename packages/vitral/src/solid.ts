/**
 * Adaptador Solid (e SolidStart).
 *
 * Remote: export default solidRemote(App)
 * Host:   <Remote name="carrinho" props={{ userId: id() }} />
 */
import { createComponent, createEffect, createSignal, mergeProps, on, onCleanup, onMount, type Component, type JSX } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { isServer, render } from 'solid-js/web'
import { defineRemote, type Isolation, type Props, type RemoteContext, type RemoteError, type RemoteModule, type RemoteSlot, type SlotStatus } from './index'
import { hostSlot, type Loading, type Prefetch } from './core/host-slot'

/** Transforma um componente Solid em um remote. O contexto chega na prop `vitral`. */
export function solidRemote<P extends Props>(Comp: Component<any>): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      const [state, setState] = createStore<Record<string, unknown>>({ ...props })
      // mergeProps mantém as props reativas: o componente lê direto da store.
      const dispose = render(() => createComponent(Comp, mergeProps(state, { vitral: ctx })), el)
      return {
        update: (next) => setState(reconcile({ ...next })),
        unmount: dispose,
      }
    },
  })
}

export interface RemoteProps<P extends Props = Props> {
  name: string
  props?: P
  isolate?: Isolation
  fallback?: JSX.Element
  error?: (error: RemoteError, retry: () => void) => JSX.Element
  class?: string
  /** `'lazy'`: monta perto de aparecer na tela; `'idle'`: com o navegador ocioso. */
  loading?: Loading
  /** Baixa antes de montar: `'hover'`, `'visible'` ou `'idle'`. */
  prefetch?: Prefetch
  /** `'high'` para o remote que aparece logo ao abrir a página. */
  priority?: RequestPriority
  /** Ao sair da página, guarda o remote montado (LRU, padrão 5) e na volta só atualiza as props. */
  keepAlive?: boolean | number
}

export function Remote<P extends Props = Props>(p: RemoteProps<P>): JSX.Element {
  // No servidor (SolidStart) só o fallback; o remote monta no cliente.
  if (isServer) return p.fallback ?? null
  const [status, setStatus] = createSignal<SlotStatus>('loading')
  const [error, setError] = createSignal<RemoteError | null>(null)
  const host = document.createElement('div')
  host.setAttribute('data-vitral', p.name)
  if (p.class) host.className = p.class
  const target = document.createElement('div')
  let slot: RemoteSlot<P> | null = null

  onMount(() => {
    slot = hostSlot<P>(target, {
      name: p.name,
      props: (p.props ?? {}) as P,
      isolate: p.isolate,
      loading: p.loading,
      prefetch: p.prefetch,
      priority: p.priority,
      keepAlive: p.keepAlive,
      onStatus: (s, e) => {
        host.setAttribute('data-vitral-status', s)
        setError(() => e)
        setStatus(s)
      },
    })
  })
  createEffect(on(() => [p.name, p.isolate] as const, ([name, isolate]) => slot?.set({ name, isolate }), { defer: true }))
  createEffect(on(() => ({ ...(p.props ?? {}) }), (props) => slot?.update(props as P), { defer: true }))
  onCleanup(() => slot?.destroy())

  const retry = () => slot?.retry()
  return [
    () => (status() === 'loading' ? p.fallback : null),
    () => (status() === 'error' && error() && p.error ? p.error(error()!, retry) : null),
    (host.appendChild(target), host),
  ] as unknown as JSX.Element
}

export type { RemoteContext }
export { events, navigate } from './index'
