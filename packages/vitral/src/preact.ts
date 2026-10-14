/**
 * Adaptador Preact.
 *
 * Remote: export default preactRemote(App)
 * Host:   <Remote name="carrinho" props={{ userId }} fallback={<p>…</p>} />
 */
import { h, render, type ComponentType, type VNode } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { createSlot, defineRemote, shared, type Isolation, type Props, type RemoteContext, type RemoteError, type RemoteModule, type RemoteSlot, type Shared, type SlotStatus, type CheckedProps } from './index'
import { memoSelect, same } from './core/shared'

/** Transforma um componente Preact em um remote. O contexto chega na prop `vitral`. */
export function preactRemote<P extends Props>(Component: ComponentType<any>): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      const draw = (p: P) => render(h(Component, { ...p, vitral: ctx }), el)
      draw(props)
      return { update: draw, unmount: () => render(null, el) }
    },
  })
}

export interface RemoteProps<P extends Props = Props> {
  name?: string
  /** URL do `vitral.json`. Dispensa `configure()`. */
  src?: string
  props?: P
  isolate?: Isolation
  fallback?: VNode | string | null
  error?: VNode | string | ((error: RemoteError, retry: () => void) => VNode | string | null) | null
  class?: string
}

export function Remote<P extends Props = Props, N extends string = string>({ name, src, props, isolate, fallback = null, error = null, ...rest }: RemoteProps<P> & CheckedProps<N>) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useRef<RemoteSlot<P> | null>(null)
  const [state, setState] = useState<{ status: SlotStatus; error: RemoteError | null }>({ status: 'loading', error: null })

  useEffect(() => {
    slot.current = createSlot<P>(ref.current!, { name, src, props: (props ?? {}) as P, isolate, onStatus: (status, error) => setState({ status, error }) })
    return () => slot.current?.destroy()
  }, [])
  useEffect(() => slot.current?.set({ name, src, isolate }), [name, src, isolate])
  useEffect(() => slot.current?.update((props ?? {}) as P), [props])

  const retry = () => slot.current?.retry()
  return h('div', { 'data-vitral': name ?? src, 'data-vitral-status': state.status, class: rest.class }, [
    state.status === 'loading' ? fallback : null,
    state.status === 'error' && state.error ? (typeof error === 'function' ? error(state.error, retry) : error) : null,
    // O Preact nunca coloca filhos neste div: ele pertence ao remote.
    h('div', { ref }),
  ])
}

/**
 * Lê uma chave compartilhada (`provide`/`shared`) e re-renderiza só quando
 * ela muda. Com seletor, só quando o resultado do seletor muda (`Object.is`).
 *
 *   const nome = useShared('usuario', (u) => u?.nome)
 */
export function useShared<K extends keyof Shared, S = Shared[K] | undefined>(key: K, select?: (value: Shared[K] | undefined) => S): S
export function useShared<T = unknown, S = T | undefined>(key: string, select?: (value: T | undefined) => S): S
export function useShared(key: string, select: (value: unknown) => unknown = same): unknown {
  const handle = useMemo(() => shared(key), [key])
  const [pick] = useState(memoSelect)
  const [, rerender] = useState(0)
  const value = pick(handle.get(), select)
  const latest = useRef({ value, select })
  latest.current = { value, select }
  useEffect(
    () =>
      // subscribe chama na hora: pega mudanças entre o render e o efeito.
      handle.subscribe((v) => {
        if (!Object.is(pick(v, latest.current.select), latest.current.value)) rerender((n) => n + 1)
      }),
    [handle],
  )
  return value
}

export type { RemoteContext }
export { events, navigate } from './index'
