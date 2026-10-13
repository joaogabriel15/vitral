'use client'
/**
 * Adaptador React (funciona em Vite, CRA e Next.js App/Pages Router).
 *
 * Host:   <Remote name="carrinho" props={{ userId }} />
 * Remote: export default reactRemote(App)
 */
import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  defineRemote,
  events,
  mountRemote,
  type EventBus,
  type Isolation,
  type MountedRemote,
  type Props,
  type RemoteContext,
  type RemoteModule,
} from './index'

// ---------------------------------------------------------------------------
// Lado do remote
// ---------------------------------------------------------------------------

const IlhaContext = createContext<RemoteContext | null>(null)

/** Transforma um componente React em um remote. */
export function reactRemote<P extends Props>(Component: ComponentType<P>): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      const root = createRoot(el)
      const render = (p: P) =>
        root.render(
          <IlhaContext.Provider value={ctx}>
            <Component {...p} />
          </IlhaContext.Provider>,
        )
      render(props)
      return { update: render, unmount: () => root.unmount() }
    },
  })
}

/** Dentro de um remote: dá acesso ao contexto (nome, eventos, baseUrl). */
export function useIlha(): RemoteContext | null {
  return useContext(IlhaContext)
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
}: RemoteProps<P>) {
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
    mountRemote<P>(el, name, latestProps.current, { isolate }).then(
      (h) => {
        if (cancelled) return h.unmount()
        handle.current = h
        setStatus('ready')
      },
      (e: Error) => {
        if (cancelled) return
        setErr(e)
        setStatus('error')
        if (onErrorRef.current) onErrorRef.current(e)
        else console.error(e)
      },
    )
    return () => {
      cancelled = true
      const h = handle.current
      handle.current = null
      // Desmonta depois do commit atual para não desmontar uma root React
      // durante a renderização de outra.
      if (h) queueMicrotask(() => h.unmount())
    }
  }, [name, isolate, attempt])

  useEffect(() => {
    handle.current?.update?.(latestProps.current)
  }, [props])

  const retry = () => setAttempt((a) => a + 1)

  return (
    <div className={className} data-ilha={name} data-ilha-status={status}>
      {status === 'loading' && fallback}
      {status === 'error' && err && (typeof error === 'function' ? error(err, retry) : (error ?? null))}
      {/* O React nunca coloca filhos neste div: ele pertence ao remote. */}
      <div key={`${name}:${isolate}:${attempt}`} ref={slot} style={status === 'error' ? { display: 'none' } : undefined} />
    </div>
  )
}
