'use client'
/**
 * Adaptador React (funciona em Vite, CRA e Next.js App/Pages Router).
 *
 * Host:   <Remote name="carrinho" props={{ userId }} />
 *         <Remote src="https://cdn.exemplo.com/carrinho/vitral.json" props={{ userId }} />
 * Remote: export default reactRemote(App)
 */
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'
import { hostSlot, when, type Loading, type Prefetch } from './core/host-slot'
import { policy } from './core/policy'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { RemoteTree, StateContext, VitralContext } from './react-tree'
import * as ReactAll from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as JSXRuntime from 'react/jsx-runtime'
import * as JSXDevRuntime from 'react/jsx-dev-runtime'
import { dedupeModule } from './core/bundled'
import { protocol } from './core/state'
import {
  defineRemote,
  events,
  preload as corePreload,
  type PreloadOptions,
  shared,
  type CheckedProps,
  type EventBus,
  type Isolation,
  type Props,
  type RemoteContext,
  type RemoteError,
  type RemoteModule,
  type RemoteSlot,
  type Shared,
  type SlotStatus,
} from './index'
import { memoSelect, same } from './core/shared'

// ---------------------------------------------------------------------------
// Lado do remote
// ---------------------------------------------------------------------------

/**
 * Transforma um componente React em um remote. Com o HTML do servidor
 * (`reactRender` de `vitral/react-server`, no gateway), hidrata em vez de montar.
 */
export function reactRemote<P extends Props>(Component: ComponentType<P>): RemoteModule<P> {
  const start = (el: HTMLElement, props: P, ctx: RemoteContext, hydrate: boolean) => {
    const tree = (p: P) => <RemoteTree Component={Component} props={p} ctx={ctx} />
    const options = { onUncaughtError: (e: unknown) => ctx.reportError(e) }
    // Com CSS escopado e portais no `body` (fora do Shadow DOM), os portais ganham o escopo do remote.
    const scope = ctx.portalContainer === document.body && el.closest('[data-vitral-scope]')?.getAttribute('data-vitral-scope')
    // Num chunk à parte: o host que só usa `<Remote>` não leva esse código.
    let stop: (() => void) | undefined
    let gone = false
    if (scope) void import('./core/portals').then((m) => gone || (stop = m.scopePortals(el, scope)))
    const root = hydrate ? hydrateRoot(el, tree(props), options) : createRoot(el, options)
    const render = (p: P) => root.render(tree(p))
    if (!hydrate) render(props)
    return {
      update: render,
      unmount: () => {
        root.unmount()
        gone = true
        stop?.()
      },
    }
  }
  return defineRemote<P>({
    mount: (el, props, ctx) => start(el, props, ctx, false),
    hydrate: (el, props, ctx) => start(el, props, ctx, true),
  })
}

/** Dentro de um remote: dá acesso ao contexto (nome, eventos, baseUrl). */
export function useVitral(): RemoteContext | null {
  return useContext(VitralContext)
}

/**
 * Dentro de um remote: o estado que o `render` do servidor buscou
 * (`reactRender(C, { state })`). O mesmo no SSR e na hidratação; numa
 * montagem sem SSR, `undefined`.
 */
export function useInitialState<T = unknown>(): T | undefined {
  return useContext(StateContext) as T | undefined
}

/**
 * Dentro de um remote: onde renderizar portais. No Shadow DOM é um elemento
 * dentro do shadow root (com os estilos do remote); fora de um remote,
 * `undefined`, e a biblioteca usa o padrão dela (`document.body`). Use em
 * `<Popover.Portal container={usePortalContainer()}>`.
 */
export function usePortalContainer(): HTMLElement | undefined {
  return useVitral()?.portalContainer
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
  /** `'lazy'`: monta perto de aparecer na tela; `'idle'`: com o navegador ocioso. */
  loading?: Loading
  /** Baixa antes de montar: `'hover'`, `'visible'` ou `'idle'`. */
  prefetch?: Prefetch
  /** `'high'` para o remote que aparece logo ao abrir a página. */
  priority?: RequestPriority
  /** Ao sair da página, guarda o remote montado (LRU, padrão 5) e na volta só atualiza as props. */
  keepAlive?: boolean | number
  /**
   * HTML do remote renderizado no servidor (`remoteProps` de
   * `vitral/next-server` com `ssr`). Aparece antes do JS e o remote hidrata
   * em vez de montar. As `props` têm de ser as mesmas do servidor.
   */
  ssr?: string | null
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
  p.pending(dedupeModule().then((m) => m.offer(p, { react: { version: ReactAll.version, modules } })).catch(() => {}))
}

/**
 * Começa a baixar um remote antes de algum `<Remote>` montar (no ocioso, no
 * hover). Já oferece o React do host, para o remote com `dedupe` não baixar
 * a própria cópia.
 */
export function preload(name: string, options?: PreloadOptions): void {
  offerReact()
  corePreload(name, options)
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
  loading,
  prefetch,
  priority,
  keepAlive,
  ssr,
}: RemoteProps<P> & CheckedProps<N>) {
  const target = useRef<HTMLDivElement>(null)
  const slot = useRef<RemoteSlot<P> | null>(null)
  const [state, setState] = useState<{ status: SlotStatus; error: RemoteError | null }>({ status: 'loading', error: null })
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  // O HTML do servidor só entra no primeiro render: o React não mexe mais nele.
  const [html] = useState(() => ssr || null)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    offerReact()
    const options = {
      name,
      src,
      props: (props ?? {}) as P,
      isolate,
      loading,
      prefetch,
      priority,
      keepAlive,
      onStatus(status: SlotStatus, e: RemoteError | null) {
        setState({ status, error: e })
        if (e) {
          if (onErrorRef.current) onErrorRef.current(e)
          else console.error(e)
        }
      },
    }
    const holder = html && target.current!.querySelector<HTMLElement>(':scope>[data-vitral-ssr]')
    let dead = false
    let s: RemoteSlot<P> | null = null
    if (holder) {
      // Hidrata o HTML do servidor. Com 2G ou economia de dados, só quando ele aparece na tela.
      const go = () =>
        import('./core/hydrate').then((m) => {
          if (!dead) slot.current = s = m.hydrateSlot<P>(target.current!, holder, { ...options, props: (latest.current ?? {}) as P })
        })
      const stop = policy() === 'lazy' ? when(target.current!, 'visible', go) : (go(), () => {})
      const end = () => (stop(), (dead = true))
      return () => {
        end()
        slot.current = null
        queueMicrotask(() => s?.destroy())
      }
    }
    slot.current = s = hostSlot<P>(target.current!, options)
    return () => {
      slot.current = null
      // Desmonta depois do commit atual para não desmontar uma root React
      // durante a renderização de outra.
      queueMicrotask(() => s!.destroy())
    }
  }, [])
  useEffect(() => slot.current?.set({ name, src, isolate }), [name, src, isolate])
  useEffect(() => slot.current?.update((props ?? {}) as P), [props])

  const retry = () => slot.current?.retry()
  const { status, error: err } = state

  return (
    <div className={className} data-vitral={name ?? src} data-vitral-status={status}>
      {status === 'loading' && !html && fallback}
      {status === 'error' && err && (typeof error === 'function' ? error(err, retry) : (error ?? null))}
      {/* O React nunca coloca filhos neste div: ele pertence ao remote. */}
      {html ? <div ref={target} dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning /> : <div ref={target} />}
    </div>
  )
}
