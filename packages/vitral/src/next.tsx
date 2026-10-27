'use client'
/**
 * Código escrito para Next.js rodando como remote do vitral, buildado com Vite.
 * Com `vitral({ next: true })`, os imports de `next/link`, `next/image`,
 * `next/head`, `next/dynamic`, `next/router` e `next/navigation` vêm daqui.
 *
 * O roteador lê a URL da página. Um host que já controla a rota (um app Next
 * com o próprio roteador) passa um `RouterContext` e os componentes usam o
 * dele: `next/dist/shared/lib/router-context.shared-runtime` também vem daqui.
 */
import {
  Children,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  Fragment,
  isValidElement,
  lazy,
  Suspense,
  useContext,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type ImgHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { navigate } from './core/navigate'

let base = ''

/** `basePath` do `next.config`. O plugin chama ao carregar os módulos `next/*`. */
export function setBasePath(path = ''): void {
  base = path.replace(/\/+$/, '')
}

type Query = Record<string, string | string[] | undefined>
export type Url = string | { pathname?: string | null; query?: Query | string | null; hash?: string | null }

export interface NextRouter {
  pathname: string
  route: string
  asPath: string
  query: Query
  basePath: string
  isReady: boolean
  isFallback: boolean
  isPreview: boolean
  isLocaleDomain: boolean
  locale?: string
  push(url: Url, as?: Url, options?: { scroll?: boolean }): Promise<boolean>
  replace(url: Url, as?: Url, options?: { scroll?: boolean }): Promise<boolean>
  back(): void
  forward(): void
  reload(): void
  prefetch(url: string): Promise<void>
  beforePopState(cb: unknown): void
  events: { on(type: string, fn: (...args: any[]) => void): void; off(type: string, fn: (...args: any[]) => void): void; emit(type: string, ...args: any[]): void }
  /** Só no roteador do host (`NextRemote`): o `href` que o `<Link>` mostra, já com a rota pública. */
  hrefOf?(path: string): string
}

/** O contexto que o `useRouter` do Next lê. O host que manda na rota fornece um. */
export const RouterContext = createContext<NextRouter | null>(null)

const listeners = new Set<() => void>()
const changed = () => listeners.forEach((fn) => fn())

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  addEventListener('popstate', fn)
  return () => {
    listeners.delete(fn)
    removeEventListener('popstate', fn)
  }
}

const here = () => (typeof location === 'undefined' ? '/' : location.pathname + location.search + location.hash)

const inBase = (path: string) => !base || path === base || path.startsWith(base + '/')

/** Caminho sem o `basePath`, como o Next mostra em `asPath` e `usePathname`. */
function strip(path: string): string {
  return base && inBase(path) ? path.slice(base.length) || '/' : path
}

function queryString(query: Query | string | null | undefined): string {
  if (!query) return ''
  if (typeof query === 'string') return query.replace(/^\??/, query ? '?' : '')
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x))
    else if (v != null) params.append(k, String(v))
  }
  const s = params.toString()
  return s ? '?' + s : ''
}

/** `href` do Next (texto ou objeto) como texto. */
export function formatUrl(url: Url): string {
  if (typeof url === 'string') return url
  const hash = url.hash ? '#' + url.hash.replace(/^#/, '') : ''
  return (url.pathname ?? '') + queryString(url.query) + hash
}

/** Caminho absoluto ganha o `basePath`, como no Next. */
function withBase(href: string, prefix = base): string {
  return prefix && href.startsWith('/') && !href.startsWith('//') ? prefix + (href === '/' ? '' : href) : href
}

const isExternal = (href: string) => /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')

function go(url: Url, replace: boolean): Promise<boolean> {
  const target = new URL(withBase(formatUrl(url)), location.href)
  if (target.origin !== location.origin || !inBase(target.pathname)) {
    // Fora do remote: a página inteira navega (host e todos os roteadores).
    navigate(target.href, { replace })
    return Promise.resolve(true)
  }
  history[replace ? 'replaceState' : 'pushState'](history.state, '', target.href)
  changed()
  return Promise.resolve(true)
}

function emitter(): NextRouter['events'] {
  const map = new Map<string, Set<(...args: any[]) => void>>()
  return {
    on: (t, fn) => void (map.get(t) ?? map.set(t, new Set()).get(t)!).add(fn),
    off: (t, fn) => void map.get(t)?.delete(fn),
    emit: (t, ...args) => map.get(t)?.forEach((fn) => fn(...args)),
  }
}

const routerEvents = emitter()

function locationRouter(current: string): NextRouter {
  const url = new URL(current, 'http://x')
  const query: Query = {}
  url.searchParams.forEach((v, k) => {
    const prev = query[k]
    query[k] = prev === undefined ? v : ([] as string[]).concat(prev, v)
  })
  const pathname = strip(url.pathname)
  return {
    pathname,
    route: pathname,
    asPath: pathname + url.search + url.hash,
    // shortcut: sem tabela de rotas, os segmentos dinâmicos ([id]) não entram em `query`; passe-os por props ou por RouterContext.
    query,
    basePath: base,
    isReady: true,
    isFallback: false,
    isPreview: false,
    isLocaleDomain: false,
    push: (u, as) => go(as ?? u, false),
    replace: (u, as) => go(as ?? u, true),
    back: () => history.back(),
    forward: () => history.forward(),
    reload: () => location.reload(),
    prefetch: () => Promise.resolve(),
    beforePopState: () => {},
    events: routerEvents,
  }
}

/** `useRouter` de `next/router`: o do `RouterContext`, se houver, senão o da URL. */
export function useRouter(): NextRouter {
  const provided = useContext(RouterContext)
  const current = useSyncExternalStore(subscribe, here, () => '/')
  const own = useMemo(() => locationRouter(current), [current])
  return provided ?? own
}

/** `Router` (export default de `next/router`): o roteador da URL fora de componentes. */
export const Router: NextRouter = new Proxy({} as NextRouter, {
  get: (_, key) => (locationRouter(here()) as any)[key],
})

export function withRouter<P extends object>(Component: ComponentType<P & { router: NextRouter }>): ComponentType<P> {
  return (props: P) => createElement(Component as ComponentType<any>, { ...props, router: useRouter() })
}

// --- next/navigation ---------------------------------------------------------

export interface AppRouter {
  push(href: string, options?: { scroll?: boolean }): void
  replace(href: string, options?: { scroll?: boolean }): void
  back(): void
  forward(): void
  refresh(): void
  prefetch(href: string): void
}

/** `useRouter` de `next/navigation`. */
export function useAppRouter(): AppRouter {
  const router = useRouter()
  return useMemo(
    () => ({
      push: (href) => void router.push(href),
      replace: (href) => void router.replace(href),
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: changed,
      prefetch: () => {},
    }),
    [router],
  )
}

export function usePathname(): string {
  return useRouter().pathname
}

export function useSearchParams(): URLSearchParams {
  const { asPath } = useRouter()
  return useMemo(() => new URL(asPath, 'http://x').searchParams, [asPath])
}

export function useParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T {
  return {} as T
}

export function redirect(url: string): never {
  void go(url, true)
  throw new Error(`NEXT_REDIRECT;${url}`)
}

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND')
}

// --- next/link ---------------------------------------------------------------

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: Url
  as?: Url
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  prefetch?: boolean | null
  passHref?: boolean
  legacyBehavior?: boolean
  locale?: string | false
  children?: ReactNode
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, as, replace, scroll, shallow: _s, prefetch: _p, passHref: _ph, legacyBehavior, locale: _l, onClick, children, ...rest },
  ref,
) {
  const router = useRouter()
  const target = formatUrl(as ?? href)
  const external = isExternal(target)
  const shown = external ? target : (router.hrefOf?.(target) ?? withBase(target, router.basePath))
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    const self = !rest.target || rest.target === '_self'
    if (e.defaultPrevented || external || !self || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    void (replace ? router.replace(target) : router.push(target))
    if (scroll !== false && typeof scrollTo === 'function') scrollTo(0, 0)
  }
  if (legacyBehavior && isValidElement(children)) {
    const child = Children.only(children) as ReactElement<any>
    return cloneElement(child, { href: shown, ref, onClick: (e: MouseEvent<HTMLAnchorElement>) => (child.props.onClick?.(e), click(e)) })
  }
  return createElement('a', { ...rest, href: shown, ref, onClick: click }, children)
})

// --- next/image --------------------------------------------------------------

type StaticImage = { src: string; width?: number; height?: number }

export type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'loading'> & {
  src: string | StaticImage
  alt: string
  width?: number | string
  height?: number | string
  fill?: boolean
  priority?: boolean
  loading?: 'eager' | 'lazy'
  quality?: number | string
  placeholder?: string
  blurDataURL?: string
  unoptimized?: boolean
  overrideSrc?: string
  loader?: (p: { src: string; width: number; quality?: number }) => string
  onLoadingComplete?: (img: HTMLImageElement) => void
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, width, height, fill, priority, loading, quality, placeholder: _ph, blurDataURL: _b, unoptimized: _u, overrideSrc, loader, onLoadingComplete, onLoad, style, ...rest },
  ref,
) {
  const image = typeof src === 'object' ? src : undefined
  const raw = image?.src ?? (src as string)
  const w = width ?? image?.width
  const h = height ?? image?.height
  const url = overrideSrc ?? (loader ? loader({ src: raw, width: Number(w) || 0, quality: quality == null ? undefined : Number(quality) }) : raw)
  const fillStyle: CSSProperties | undefined = fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : undefined
  return createElement('img', {
    ...rest,
    ref,
    src: url,
    width: fill ? undefined : w,
    height: fill ? undefined : h,
    decoding: 'async',
    loading: priority ? 'eager' : (loading ?? 'lazy'),
    fetchPriority: priority ? 'high' : undefined,
    style: fillStyle ? { ...fillStyle, ...style } : style,
    onLoad: (e: any) => (onLoad?.(e), onLoadingComplete?.(e.currentTarget)),
  })
})

// --- next/head e next/dynamic ------------------------------------------------

/** O React 19 já leva `<title>`, `<meta>` e `<link>` para o `<head>`. */
export function Head({ children }: { children?: ReactNode }) {
  return createElement(Fragment, null, children)
}

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>

export function dynamic<P extends object = object>(
  loader: Loader<P> | Promise<ComponentType<P> | { default: ComponentType<P> }>,
  options: { loading?: ComponentType<any>; ssr?: boolean } = {},
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const m: any = await (typeof loader === 'function' ? loader() : loader)
    return { default: m && typeof m === 'object' && 'default' in m ? m.default : m }
  })
  const fallback = options.loading ? createElement(options.loading, { isLoading: true, pastDelay: true, error: null }) : null
  return (props: P) => createElement(Suspense, { fallback }, createElement(Lazy as ComponentType<any>, props))
}

// --- remote dentro de um host Next (vitral/next-host) ------------------------

/** Rota pública do host e o caminho dela na zona (como no `rewrites` do Multi-Zones). */
export interface ZoneRoute {
  public: string
  zone: string
}

/** O que o `NextRemote` do host passa ao remote, na prop `__next`. */
export interface HostRouter {
  /** `asPath` do host: a URL do navegador. */
  asPath: string
  /** `basePath` do remote, como no `next.config` da zona. */
  basePath?: string
  routes?: ZoneRoute[]
  push(url: string, options?: { scroll?: boolean }): void
  replace(url: string, options?: { scroll?: boolean }): void
}

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

/** Troca o prefixo `from` pelo `to` da rota de prefixo mais longo. */
function mapPath(path: string, routes: ZoneRoute[], from: 'public' | 'zone'): string {
  const to = from === 'public' ? 'zone' : 'public'
  let best: ZoneRoute | undefined
  for (const r of routes) if (under(path, r[from]) && (!best || r[from].length > best[from].length)) best = r
  return best ? best[to] + path.slice(best[from].length) : path
}

/**
 * O roteador que o remote vê dentro do host: caminhos como numa zona com
 * `basePath` (a URL pública vira o caminho da zona, sem o `basePath`), e
 * `push` volta pelo roteador do host, com a rota pública.
 */
export function hostRouter(host: HostRouter): NextRouter {
  const basePath = (host.basePath ?? base).replace(/\/+$/, '')
  const routes = host.routes ?? []
  const url = new URL(host.asPath, 'http://x')
  const zone = mapPath(url.pathname, routes, 'public')
  const pathname = basePath && under(zone, basePath) ? zone.slice(basePath.length) || '/' : zone
  const query: Query = {}
  url.searchParams.forEach((v, k) => {
    const prev = query[k]
    query[k] = prev === undefined ? v : ([] as string[]).concat(prev, v)
  })
  const hrefOf = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? mapPath(withBase(path, basePath) || '/', routes, 'zone') : path)
  const go = (target: Url, replace: boolean, options?: { scroll?: boolean }) => {
    const next = formatUrl(target)
    if (isExternal(next)) navigate(next, { replace })
    else (replace ? host.replace : host.push)(hrefOf(next), options)
    return Promise.resolve(true)
  }
  return {
    pathname,
    route: pathname,
    asPath: pathname + url.search + url.hash,
    query,
    basePath,
    isReady: true,
    isFallback: false,
    isPreview: false,
    isLocaleDomain: false,
    push: (u, as, o) => go(as ?? u, false, o),
    replace: (u, as, o) => go(as ?? u, true, o),
    back: () => history.back(),
    forward: () => history.forward(),
    reload: () => location.reload(),
    prefetch: () => Promise.resolve(),
    beforePopState: () => {},
    events: routerEvents,
    hrefOf,
  }
}

/**
 * Embrulha o `export default` do remote no modo `next` do plugin: com a prop
 * `__next` (vinda do `NextRemote` do host), os componentes leem o roteador do
 * host; sem ela, o da URL.
 */
export function nextRemote<P extends object>(Component: ComponentType<P>): ComponentType<P & { __next?: HostRouter }> {
  return function NextRemote({ __next: host, ...props }: P & { __next?: HostRouter }) {
    const router = useMemo(() => host && hostRouter(host), [host?.asPath, host?.basePath, host?.routes, host?.push, host?.replace])
    const app = createElement(Component as ComponentType<any>, props)
    return router ? createElement(RouterContext.Provider, { value: router }, app) : app
  }
}
