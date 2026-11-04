'use client'
/**
 * Lado do host Next.js (Pages Router). Precisa do `withVitral` no
 * `next.config`, que gera a configuração lida aqui.
 *
 *   // pages/_app.tsx
 *   <VitralNext />
 *
 *   // pages/delivery/[[...slug]].tsx
 *   export default function Delivery() {
 *     return <Layout><NextRemote name="delivery" fallback={<Spinner />} /></Layout>
 *   }
 *
 * `VitralNext` registra os remotes, oferece as dependências de `share`,
 * baixa os remotes antes (rota aberta ou navegador ocioso) e troca a
 * navegação de página inteira para uma rota de remote (`location.assign`,
 * `<a>` comum) pela do roteador do Next, sem recarregar. Onde não há
 * Navigation API, a página recarrega como antes.
 */
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { createElement, Fragment, useEffect, useMemo, version as reactVersion, type ReactNode } from 'react'
import { plan, remotes, shared } from 'vitral-next-host-config'
import { bundled } from './core/bundled'
import * as dedupe from './core/dedupe'
import { hintsOf, type HtmlHints } from './core/next-hints'
import { policy } from './core/policy'
import { configure, register } from './core/registry'
import type { RemoteManifest } from './core/types'
import * as sri from './core/sri'
import type { HostRouter } from './next'
import { preload, Remote, type RemoteProps } from './react'

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

/** O remote dono do caminho público `path`, se houver. */
export function remoteFor(path: string): string | undefined {
  for (const [name, r] of Object.entries(remotes)) if (under(path, r.basePath) || r.routes?.some((x) => under(path, x.public))) return name
}

/** Versão de cada grupo que o host oferece: o React do bundle e os de `share`. */
const offered = (): Record<string, string> => ({ react: reactVersion, ...Object.fromEntries(Object.entries(shared).map(([k, g]) => [k, g.version])) })

/**
 * Ofertas de `share` com o download guardado: o aquecimento abaixo e o pedido
 * do remote usam o mesmo `import()`. Uma falha libera um novo pedido.
 */
const offers: typeof shared = Object.fromEntries(
  Object.entries(shared).map(([k, g]) => {
    let p: Promise<Record<string, unknown>> | undefined
    return [k, typeof g.modules === 'function' ? { ...g, modules: () => (p ??= g.modules().catch((e) => ((p = undefined), Promise.reject(e)))) } : g]
  }),
)

/**
 * Na página de um remote, começa já o download das ofertas que ele vai pedir.
 * O webpack põe cada `import()` da oferta num chunk à parte, que o HTML não
 * pré-carrega: sem isto, ele só começaria depois da hidratação, quando o
 * remote pede a oferta. Roda quando o `_app` é avaliado, antes da hidratação.
 */
function warmOffers(path: string): void {
  const name = remoteFor(path)
  if (!name) return
  // O manifesto do servidor (props da página, no __NEXT_DATA__) vale mais que o do build.
  const m: RemoteManifest | undefined = (window as any).__NEXT_DATA__?.props?.pageProps?.vitral?.[name]
  const list = m ? hintsOf(m, remotes[name].url, offered()).offers : remotes[name].hints?.offers
  for (const g of list ?? []) offers[g]?.modules().catch(() => {})
}
if (typeof window !== 'undefined') warmOffers(location.pathname)

let configured = false
function setup() {
  if (configured || typeof window === 'undefined') return
  configured = true
  // O código de SRI e o de dedupe vêm no bundle do host: o remote da página
  // aberta não espera mais um download à parte depois da hidratação.
  bundled.sri = sri
  bundled.dedupe = dedupe
  configure({
    remotes: Object.fromEntries(Object.entries(remotes).map(([name, r]) => [name, { url: r.url, ...(r.integrity === false && { integrity: false as const }) }])),
    dedupe: offers,
    // Uma cópia de cada dependência para todos os remotes, escolhida no build.
    ...(plan && Object.keys(plan).length && { dedupePlan: plan }),
  })
}

/** Navegação de página inteira para uma rota de remote vira `Router.push`. Devolve a função que desliga. */
export function interceptNavigation(): () => void {
  const nav = (globalThis as any).navigation
  if (!nav) return interceptClicks()
  // Se o próprio Next pedir página inteira para a mesma URL (erro ao carregar a rota), deixa passar.
  // Só a troca concluída zera: o Next emite `routeChangeError` logo antes dessa navegação.
  let last: string | undefined
  const done = () => (last = undefined)
  const on = (e: any) => {
    if (e.destination.sameDocument || !e.cancelable || e.hashChange || e.downloadRequest || e.formData) return
    if (e.navigationType !== 'push' && e.navigationType !== 'replace') return
    const url = new URL(e.destination.url)
    const path = url.pathname + url.search + url.hash
    if (url.origin !== location.origin || !remoteFor(url.pathname) || last === path) return
    e.preventDefault()
    last = path
    void (e.navigationType === 'replace' ? Router.replace(path) : Router.push(path))
  }
  nav.addEventListener('navigate', on)
  Router.events.on('routeChangeComplete', done)
  return () => {
    nav.removeEventListener('navigate', on)
    Router.events.off('routeChangeComplete', done)
  }
}

/**
 * Sem Navigation API (Firefox e Safari antigos): só os cliques em `<a>` comuns
 * para rota de remote viram `Router.push`. `location.assign` não tem como ser
 * interceptado e continua recarregando a página.
 */
function interceptClicks(): () => void {
  const on = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
    const url = new URL(a.href, location.href)
    if (url.origin !== location.origin || !remoteFor(url.pathname)) return
    // Só o hash muda: o navegador rola sem recarregar.
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return
    e.preventDefault()
    void Router.push(url.pathname + url.search + url.hash)
  }
  document.addEventListener('click', on)
  return () => document.removeEventListener('click', on)
}

/** Coloque uma vez, no `_app`. */
export function VitralNext(): null {
  setup()
  useEffect(() => {
    const here = remoteFor(location.pathname)
    const go = (name: string) => preload(name, { routes: !!remotes[name].warmRoutes })
    if (here) go(here)
    const idle: number[] = []
    // Rede lenta ou aparelho fraco: só o remote da página.
    const all = policy() === 'all'
    for (const [name, r] of Object.entries(remotes))
      if (all && name !== here && (r.preload ?? 'idle') === 'idle')
        idle.push(typeof requestIdleCallback === 'function' ? requestIdleCallback(() => go(name), { timeout: 5000 }) : window.setTimeout(() => go(name), 2000))
    const stop = interceptNavigation()
    return () => {
      stop()
      for (const id of idle) typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id)
    }
  }, [])
  return null
}

export type NextRemoteProps = Omit<RemoteProps, 'name' | 'src'> & {
  name: string
  /**
   * O `vitral.json` lido no servidor (`remoteProps` de `vitral/next-server`).
   * Com ele, o HTML pré-carrega a versão publicada agora e o navegador não
   * pede o manifesto. `null` ou ausente: o preload do build e o pedido de sempre.
   */
  manifest?: RemoteManifest | null
}

/** O manifesto do servidor vira o registro do remote: o loader não pede de novo. */
const seeded = new Map<string, RemoteManifest>()
function seed(name: string, m: RemoteManifest): void {
  const r = remotes[name]
  if (!r || typeof window === 'undefined' || seeded.get(name) === m) return
  seeded.set(name, m)
  register(name, { url: r.url, manifest: m, ...(r.integrity === false && { integrity: false as const }) })
}

const push: HostRouter['push'] = (url, options) => void Router.push(url, undefined, options)
const replace: HostRouter['replace'] = (url, options) => void Router.replace(url, undefined, options)

/**
 * `<link rel="preload">` do que a primeira tela do remote baixa, lidos do
 * `vitral.json` no build do host. Com eles no HTML, o remote baixa junto com o
 * JS do host, e não depois da hidratação. O hash vai no `integrity`: o
 * navegador confere o preload, e o `import()` do remote confere de novo.
 */
function hints(h: HtmlHints | undefined, shadow: boolean): ReactNode {
  if (!h) return null
  const link = (as: string, [href, integrity, fetchPriority]: [string, string?, 'high'?]) =>
    createElement('link', { key: `vitral:${href}`, rel: 'preload', as, href, crossOrigin: 'anonymous', ...(integrity && { integrity }), ...(fetchPriority && { fetchPriority }) })
  return createElement(
    Head,
    null,
    ...(h.manifest ? [link('fetch', [h.manifest])] : []),
    // Com Shadow DOM o CSS vem por fetch: o preload de estilo não serviria.
    ...(shadow ? [] : h.css.map((c) => link('style', c))),
    ...h.js.map((j) => link('script', j)),
  )
}

/**
 * O remote na página do host. Passa o roteador do Next ao remote (prop
 * `__next`, lida pelo plugin no modo `next`): `useRouter`, `<Link>` e
 * `router.push` do remote usam o do host, com as rotas públicas.
 */
export function NextRemote({ name, props, fallback = null, manifest, ...rest }: NextRemoteProps): ReactNode {
  setup()
  if (manifest) seed(name, manifest)
  const router = useRouter()
  const r = remotes[name]
  const host = useMemo<HostRouter>(() => ({ asPath: router.asPath, basePath: r?.basePath, routes: r?.routes, push, replace, events: Router.events }), [router.asPath, r])
  const all = useMemo(() => ({ ...props, __next: host }), [props, host])
  const links = useMemo(() => {
    const h = manifest && r ? hintsOf(manifest, r.url, offered(), r.integrity) : r?.hints
    // Com o manifesto do servidor, o navegador não pede o vitral.json: sem preload dele.
    return hints(manifest && h ? { ...h, manifest: '' } : h, rest.isolate === 'shadow')
  }, [manifest, r, rest.isolate])
  return createElement(Fragment, null, links, router.isReady ? createElement(Remote, { ...rest, name, fallback, props: all }) : fallback)
}
