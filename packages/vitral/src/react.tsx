'use client'
/**
 * Adaptador React (funciona em Vite, CRA e Next.js App/Pages Router).
 *
 * Host:   <Remote name="carrinho" props={{ userId }} />
 * Remote: export default reactRemote(App)
 */
import { Component as ReactComponent, createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { hostSlot, type Loading, type Prefetch } from './core/host-slot'
import { createRoot } from 'react-dom/client'
import * as ReactAll from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as JSXRuntime from 'react/jsx-runtime'
import * as JSXDevRuntime from 'react/jsx-dev-runtime'
import { protocol } from './core/state'
import {
  defineRemote,
  events,
  type EventBus,
  type Isolation,
  type Props,
  type RemoteContext,
  type RemoteError,
  type RemoteModule,
  type RemoteSlot,
  type SlotStatus,
} from './index'

// ---------------------------------------------------------------------------
// Lado do remote
// ---------------------------------------------------------------------------

const VitralContext = createContext<RemoteContext | null>(null)

/** Erro de render dentro do remote vai para o host em vez de derrubar a página. */
class Boundary extends ReactComponent<{ ctx: RemoteContext; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    this.props.ctx.reportError(error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Transforma um componente React em um remote. */
export function reactRemote<P extends Props>(Component: ComponentType<P>): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      const root = createRoot(el, { onUncaughtError: (e) => ctx.reportError(e) })
      const render = (p: P) =>
        root.render(
          <VitralContext.Provider value={ctx}>
            <Boundary ctx={ctx}>
              <Component {...p} />
            </Boundary>
          </VitralContext.Provider>,
        )
      render(props)
      return { update: render, unmount: () => root.unmount() }
    },
  })
}

/** Dentro de um remote: dá acesso ao contexto (nome, eventos, baseUrl). */
export function useVitral(): RemoteContext | null {
  return useContext(VitralContext)
}

/** Assina um evento do barramento global enquanto o componente estiver montado. */
export function useEvent<T = unknown>(type: string, handler: (payload: T) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => events.on<T>(type, (p) => ref.current(p)), [type])
}

/** Estado derivado do último valor emitido em `type`. */
export function useEventValue<T = unknown>(type: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => events.last<T>(type))
  useEvent<T>(type, setValue)
  return value
}

export { events, type EventBus }

// ---------------------------------------------------------------------------
// Lado do host
// ---------------------------------------------------------------------------

export interface RemoteProps<P extends Props = Props> {
  name: string
  props?: P
  isolate?: Isolation
  /** Mostrado enquanto o remote baixa. */
  fallback?: ReactNode
  /** Mostrado se o remote falhar. Recebe o erro e uma função para tentar de novo. */
  error?: ReactNode | ((error: Error, retry: () => void) => ReactNode)
  onError?: (error: Error) => void
  className?: string
  /** `'lazy'`: monta perto de aparecer na tela; `'idle'`: com o navegador ocioso. */
  loading?: Loading
  /** Baixa antes de montar: `'hover'`, `'visible'` ou `'idle'`. */
  prefetch?: Prefetch
  /** `'high'` para o remote que aparece logo ao abrir a página. */
  priority?: RequestPriority
  /** Ao sair da página, guarda o remote montado (LRU, padrão 5) e na volta só atualiza as props. */
  keepAlive?: boolean | number
}

let offeredTo: object | undefined

/**
 * Oferece o React do host aos remotes com `dedupe: ['react']`. O grupo vem
 * inteiro daqui, porque o React DOM exige a mesma versão do React.
 */
function offerReact() {
  const p = protocol()
  if (offeredTo === p) return
  offeredTo = p
  const compiler = (ReactAll as any).__COMPILER_RUNTIME
  const modules = {
    react: ReactAll,
    'react-dom': ReactDOM,
    'react-dom/client': ReactDOMClient,
    'react/jsx-runtime': JSXRuntime,
    'react/jsx-dev-runtime': JSXDevRuntime,
    // O React 19 expõe o react/compiler-runtime pelo próprio react.
    ...(compiler && { 'react/compiler-runtime': compiler }),
  }
  // Fora do host mínimo; os downloads esperam a oferta (pending).
  p.pending(import('./core/shared').then((m) => m.offer(p, { react: { version: ReactAll.version, modules } })).catch(() => {}))
}

/**
 * Renderiza um remote. No servidor (Next SSR) renderiza só o fallback; o
 * remote monta no cliente, então não há erro de hidratação.
 */
export function Remote<P extends Props = Props>({
  name,
  props,
  isolate,
  fallback = null,
  error,
  onError,
  className,
  loading,
  prefetch,
  priority,
  keepAlive,
}: RemoteProps<P>) {
  const target = useRef<HTMLDivElement>(null)
  const slot = useRef<RemoteSlot<P> | null>(null)
  const [state, setState] = useState<{ status: SlotStatus; error: RemoteError | null }>({ status: 'loading', error: null })
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    offerReact()
    const s = hostSlot<P>(target.current!, {
      name,
      props: (props ?? {}) as P,
      isolate,
      loading,
      prefetch,
      priority,
      keepAlive,
      onStatus(status, e) {
        setState({ status, error: e })
        if (e) {
          if (onErrorRef.current) onErrorRef.current(e)
          else console.error(e)
        }
      },
    })
    slot.current = s
    return () => {
      slot.current = null
      // Desmonta depois do commit atual para não desmontar uma root React
      // durante a renderização de outra.
      queueMicrotask(() => s.destroy())
    }
  }, [])
  useEffect(() => slot.current?.set({ name, isolate }), [name, isolate])
  useEffect(() => slot.current?.update((props ?? {}) as P), [props])

  const retry = () => slot.current?.retry()
  const { status, error: err } = state

  return (
    <div className={className} data-vitral={name} data-vitral-status={status}>
      {status === 'loading' && fallback}
      {status === 'error' && err && (typeof error === 'function' ? error(err, retry) : (error ?? null))}
      {/* O React nunca coloca filhos neste div: ele pertence ao remote. */}
      <div ref={target} />
    </div>
  )
}
