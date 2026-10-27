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
import Router, { useRouter } from 'next/router'
import { createElement, useEffect, useMemo, type ReactNode } from 'react'
import { remotes, shared } from 'vitral-next-host-config'
import { configure } from './core/registry'
import type { HostRouter } from './next'
import { preload, Remote, type RemoteProps } from './react'

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

/** O remote dono do caminho público `path`, se houver. */
export function remoteFor(path: string): string | undefined {
  for (const [name, r] of Object.entries(remotes)) if (under(path, r.basePath) || r.routes?.some((x) => under(path, x.public))) return name
}

let configured = false
function setup() {
  if (configured || typeof window === 'undefined') return
  configured = true
  configure({
    remotes: Object.fromEntries(Object.entries(remotes).map(([name, r]) => [name, { url: r.url, ...(r.integrity === false && { integrity: false as const }) }])),
    dedupe: shared,
  })
}

/** Navegação de página inteira para uma rota de remote vira `Router.push`. Devolve a função que desliga. */
export function interceptNavigation(): () => void {
  const nav = (globalThis as any).navigation
  if (!nav) return () => {}
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

/** Coloque uma vez, no `_app`. */
export function VitralNext(): null {
  setup()
  useEffect(() => {
    const here = remoteFor(location.pathname)
    const go = (name: string) => preload(name, { routes: !!remotes[name].warmRoutes })
    if (here) go(here)
    const idle: number[] = []
    for (const [name, r] of Object.entries(remotes))
      if (name !== here && (r.preload ?? 'idle') === 'idle')
        idle.push(typeof requestIdleCallback === 'function' ? requestIdleCallback(() => go(name), { timeout: 5000 }) : window.setTimeout(() => go(name), 2000))
    const stop = interceptNavigation()
    return () => {
      stop()
      for (const id of idle) typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id)
    }
  }, [])
  return null
}

export type NextRemoteProps = Omit<RemoteProps, 'name' | 'src'> & { name: string }

const push: HostRouter['push'] = (url, options) => void Router.push(url, undefined, options)
const replace: HostRouter['replace'] = (url, options) => void Router.replace(url, undefined, options)

/**
 * O remote na página do host. Passa o roteador do Next ao remote (prop
 * `__next`, lida pelo plugin no modo `next`): `useRouter`, `<Link>` e
 * `router.push` do remote usam o do host, com as rotas públicas.
 */
export function NextRemote({ name, props, fallback = null, ...rest }: NextRemoteProps): ReactNode {
  setup()
  const router = useRouter()
  const r = remotes[name]
  const host = useMemo<HostRouter>(() => ({ asPath: router.asPath, basePath: r?.basePath, routes: r?.routes, push, replace, events: Router.events }), [router.asPath, r])
  const all = useMemo(() => ({ ...props, __next: host }), [props, host])
  if (!router.isReady) return fallback
  return createElement(Remote, { ...rest, name, fallback, props: all })
}
