/**
 * Adaptador Preact.
 *
 * Remote: export default preactRemote(App)
 * Host:   <Remote name="carrinho" props={{ userId }} fallback={<p>…</p>} />
 */
import { h, render, type ComponentType, type VNode } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { createSlot, defineRemote, type Isolation, type Props, type RemoteContext, type RemoteError, type RemoteModule, type RemoteSlot, type SlotStatus } from './index'

/** Transforma um componente Preact em um remote. O contexto chega na prop `arquipelago`. */
export function preactRemote<P extends Props>(Component: ComponentType<any>): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      const draw = (p: P) => render(h(Component, { ...p, ilha: ctx }), el)
      draw(props)
      return { update: draw, unmount: () => render(null, el) }
    },
  })
}

export interface RemoteProps<P extends Props = Props> {
  name: string
  props?: P
  isolate?: Isolation
  fallback?: VNode | string | null
  error?: VNode | string | ((error: RemoteError, retry: () => void) => VNode | string | null) | null
  class?: string
}

export function Remote<P extends Props = Props>({ name, props, isolate, fallback = null, error = null, ...rest }: RemoteProps<P>) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useRef<RemoteSlot<P> | null>(null)
  const [state, setState] = useState<{ status: SlotStatus; error: RemoteError | null }>({ status: 'loading', error: null })

  useEffect(() => {
    slot.current = createSlot<P>(ref.current!, { name, props: (props ?? {}) as P, isolate, onStatus: (status, error) => setState({ status, error }) })
    return () => slot.current?.destroy()
  }, [])
  useEffect(() => slot.current?.set({ name, isolate }), [name, isolate])
  useEffect(() => slot.current?.update((props ?? {}) as P), [props])

  const retry = () => slot.current?.retry()
  return h('div', { 'data-ilha': name, 'data-ilha-status': state.status, class: rest.class }, [
    state.status === 'loading' ? fallback : null,
    state.status === 'error' && state.error ? (typeof error === 'function' ? error(state.error, retry) : error) : null,
    // O Preact nunca coloca filhos neste div: ele pertence ao remote.
    h('div', { ref }),
  ])
}

export type { RemoteContext }
export { events, navigate } from './index'
