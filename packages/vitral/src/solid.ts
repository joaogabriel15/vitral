/**
 * Adaptador Solid (e SolidStart).
 *
 * Remote: export default solidRemote(App)
 * Host:   <Remote name="carrinho" props={{ userId: id() }} />
 */
import { createComponent, createEffect, createSignal, mergeProps, on, onCleanup, onMount, type Component, type JSX } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { isServer, render } from 'solid-js/web'
import { createSlot, defineRemote, type Isolation, type Props, type RemoteContext, type RemoteError, type RemoteModule, type RemoteSlot, type SlotStatus } from './index'

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
  name?: string
  /** URL do `vitral.json`. Dispensa `configure()`. */
  src?: string
  props?: P
  isolate?: Isolation
  fallback?: JSX.Element
  error?: (error: RemoteError, retry: () => void) => JSX.Element
  class?: string
}

export function Remote<P extends Props = Props>(p: RemoteProps<P>): JSX.Element {
  // No servidor (SolidStart) só o fallback; o remote monta no cliente.
  if (isServer) return p.fallback ?? null
  const [status, setStatus] = createSignal<SlotStatus>('loading')
  const [error, setError] = createSignal<RemoteError | null>(null)
  const host = document.createElement('div')
  host.setAttribute('data-vitral', p.name ?? p.src ?? '')
  if (p.class) host.className = p.class
  const target = document.createElement('div')
  let slot: RemoteSlot<P> | null = null

  onMount(() => {
    slot = createSlot<P>(target, {
      name: p.name,
      src: p.src,
      props: (p.props ?? {}) as P,
      isolate: p.isolate,
      onStatus: (s, e) => {
        host.setAttribute('data-vitral-status', s)
        setError(() => e)
        setStatus(s)
      },
    })
  })
  createEffect(on(() => [p.name, p.src, p.isolate] as const, ([name, src, isolate]) => slot?.set({ name, src, isolate }), { defer: true }))
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
