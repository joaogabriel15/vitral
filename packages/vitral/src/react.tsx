'use client'
/**
 * Adaptador React (funciona em Vite, CRA e Next.js App/Pages Router).
 *
 * Host:   <Remote name="carrinho" props={{ userId }} />
 *         <Remote src="https://cdn.exemplo.com/carrinho/vitral.json" props={{ userId }} />
 * Remote: export default reactRemote(App)
 */
import {
  Component as ReactComponent,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import {
  defineRemote,
  events,
  mountRemote,
  shared,
  registerSrc,
  type CheckedProps,
  type EventBus,
  type Isolation,
  type MountedRemote,
  type Props,
  type RemoteContext,
  type RemoteModule,
  type Shared,
} from './index'
import { memoSelect, same } from './core/shared'

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

/**
 * Lê uma chave compartilhada (`provide`/`shared`) e re-renderiza só quando
 * ela muda. Com seletor, só quando o resultado do seletor muda (`Object.is`).
 * No servidor e na hidratação o valor é `undefined`.
 *
 *   const nome = useShared('usuario', (u) => u?.nome)
 */
export function useShared<K extends keyof Shared, S = Shared[K] | undefined>(key: K, select?: (value: Shared[K] | undefined) => S): S
export function useShared<T = unknown, S = T | undefined>(key: string, select?: (value: T | undefined) => S): S
export function useShared(key: string, select: (value: unknown) => unknown = same): unknown {
  const handle = useMemo(() => shared(key), [key])
  const [pick] = useState(memoSelect)
  return useSyncExternalStore(
    handle.subscribe,
    () => pick(handle.get(), select),
    () => pick(undefined, select),
  )
}

export { events, type EventBus }

// ---------------------------------------------------------------------------
// Lado do host
// ---------------------------------------------------------------------------

export interface RemoteProps<P extends Props = Props> {
  /** Nome registrado com `configure()`. Com `src`, o nome sob o qual a URL é registrada. */
  name?: string
  /** URL do `vitral.json`. Dispensa `configure()`. */
  src?: string
  props?: P
  isolate?: Isolation
  /** Mostrado enquanto o remote baixa. */
  fallback?: ReactNode
  /** Mostrado se o remote falhar. Recebe o erro e uma função para tentar de novo. */
  error?: ReactNode | ((error: Error, retry: () => void) => ReactNode)
  onError?: (error: Error) => void
  className?: string
}

/**
 * Renderiza um remote. No servidor (Next SSR) renderiza só o fallback; o
 * remote monta no cliente, então não há erro de hidratação. Com o nome em
 * `Remotes` (`npx vitral types`), as props são checadas.
 */
export function Remote<P extends Props = Props, N extends string = string>({
  name,
  src,
  props,
  isolate,
  fallback = null,
  error,
  onError,
  className,
}: RemoteProps<P> & CheckedProps<N>) {
  const slot = useRef<HTMLDivElement>(null)
  const handle = useRef<MountedRemote<P> | null>(null)
  const latestProps = useRef<P>((props ?? {}) as P)
  latestProps.current = (props ?? {}) as P
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [err, setErr] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    // O slot é recriado a cada nome/tentativa (veja a key abaixo), então
    // shadow roots e DOM antigos nunca são reaproveitados.
    const el = slot.current
    if (!el) return
    let cancelled = false
    setStatus('loading')
    const fail = (e: Error) => {
      if (cancelled) return
      setErr(e)
      setStatus('error')
      if (onErrorRef.current) onErrorRef.current(e)
      else console.error(e)
    }
    const initial = latestProps.current
    Promise.resolve()
      .then(() => mountRemote<P>(el, src ? registerSrc(src, name) : (name ?? ''), initial, { isolate, onError: fail }))
      .then(
      (h) => {
        if (cancelled) return h.unmount()
        handle.current = h
        // Props que mudaram enquanto o remote baixava.
        if (latestProps.current !== initial) h.update?.(latestProps.current)
        setStatus('ready')
      },
      fail,
    )
    return () => {
      cancelled = true
      const h = handle.current
      handle.current = null
      // Desmonta depois do commit atual para não desmontar uma root React
      // durante a renderização de outra.
      if (h) queueMicrotask(() => h.unmount())
    }
  }, [name, src, isolate, attempt])

  useEffect(() => {
    handle.current?.update?.(latestProps.current)
  }, [props])

  const retry = () => setAttempt((a) => a + 1)

  return (
    <div className={className} data-vitral={name ?? src} data-vitral-status={status}>
      {status === 'loading' && fallback}
      {status === 'error' && err && (typeof error === 'function' ? error(err, retry) : (error ?? null))}
      {/* O React nunca coloca filhos neste div: ele pertence ao remote. */}
      <div key={`${name}:${src}:${isolate}:${attempt}`} ref={slot} style={status === 'error' ? { display: 'none' } : undefined} />
    </div>
  )
}
