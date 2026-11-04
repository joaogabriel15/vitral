/**
 * Lado do servidor do host Next (Pages Router): o `vitral.json` do remote é
 * lido a cada requisição, com cache curto, e vai para a página como prop.
 *
 *   // pages/delivery/[[...slug]].tsx
 *   import { remoteProps } from 'vitral/next-server'
 *   export const getServerSideProps = async () => ({ props: await remoteProps('delivery') })
 *   export default function Delivery({ vitral }) {
 *     return <NextRemote name="delivery" manifest={vitral.delivery} />
 *   }
 *
 * Com o manifesto nas props, o HTML já sai com o preload da versão publicada
 * agora (não a do build do host), e o navegador não pede o manifesto: o
 * remote começa a baixar junto com o JS do host, sem a ida e volta do
 * manifesto. Se o manifesto não chega, a prop vem `null` e o navegador pede
 * como antes.
 */
import { remotes } from 'vitral-next-host-config'
import { ssrHolder, type ServerRendered } from './core/ssr-markup'
import type { Props, RemoteManifest } from './core/types'

/** SSR de um remote na página do host: o `render` do servidor do remote e as props. */
export interface RemoteSsr {
  /** O `render` que o remote exporta para o servidor (`reactRender` de `vitral/react-server`). */
  render: (props: Props) => ServerRendered | Promise<ServerRendered>
  /** As mesmas props que a página passa ao `NextRemote`. */
  props?: Props
}

export interface RemotePropsOptions {
  /** Segundos em que o manifesto guardado vale sem pedir de novo. Padrão 5. */
  maxAge?: number
  /**
   * Segundos a mais em que o manifesto guardado ainda serve, enquanto um
   * pedido novo corre por trás. Padrão 30.
   */
  staleWhileRevalidate?: number
  /**
   * Origem para o `url` relativo do remote (`/delivery-remote/vitral.json`).
   * Padrão: `VITRAL_ORIGIN` do ambiente, ou o próprio servidor Next em
   * `http://127.0.0.1:$PORT`. O header `Host` da requisição nunca é usado: um
   * cliente poderia apontar o servidor para outra máquina.
   */
  origin?: string
  /** Tempo máximo do pedido, em ms. Padrão 3000. Vale também para o `render` do SSR. */
  timeout?: number
  fetch?: typeof fetch
  /**
   * SSR por remote. O HTML vai em `vitralSsr[nome]`, para o `ssr` do
   * `NextRemote`. Sem o manifesto, com erro ou depois de `timeout`, `null`, e
   * a página monta no navegador como antes.
   */
  ssr?: Record<string, RemoteSsr>
}

interface Cached {
  at: number
  m: RemoteManifest | null
  pending?: Promise<RemoteManifest | null>
}

const cache = new Map<string, Cached>()

/** Esvazia o cache (testes). */
export function clearRemoteCache(): void {
  cache.clear()
}

function absolute(url: string, origin?: string): string {
  if (/^https?:\/\//.test(url)) return url
  const base = origin ?? process.env.VITRAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`
  return new URL(url, base.endsWith('/') ? base : base + '/').href
}

async function get(url: string, o: RemotePropsOptions): Promise<RemoteManifest | null> {
  const f = o.fetch ?? fetch
  try {
    const res = await f(url, { signal: AbortSignal.timeout(o.timeout ?? 3000), headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const m = await res.json()
    // Canal (`{ stable, canary }`): a versão é escolhida no navegador, por visitante.
    return typeof m?.entry === 'string' ? m : null
  } catch {
    return null
  }
}

/**
 * O manifesto do remote `name`, com cache em memória: dentro de `maxAge`
 * responde do cache; até `maxAge + staleWhileRevalidate`, responde do cache e
 * renova por trás; depois disso, espera o pedido novo. Um pedido que falha
 * não apaga a cópia boa que já estava guardada.
 */
export async function remoteManifest(name: string, o: RemotePropsOptions = {}): Promise<RemoteManifest | null> {
  const r = remotes[name]
  if (!r) throw new Error(`[vitral] remote ${name} não está no withVitral`)
  const url = absolute(r.url, o.origin)
  const now = Date.now()
  const fresh = (o.maxAge ?? 5) * 1000
  const stale = fresh + (o.staleWhileRevalidate ?? 30) * 1000
  const c = cache.get(url)
  const renew = () => {
    const entry = cache.get(url) ?? { at: 0, m: null }
    entry.pending ??= get(url, o).then((m) => {
      cache.set(url, m ? { at: Date.now(), m } : { ...entry, pending: undefined })
      return m ?? entry.m
    })
    cache.set(url, entry)
    return entry.pending
  }
  if (c?.m && now - c.at < fresh) return c.m
  if (c?.m && now - c.at < stale) {
    void renew()
    return c.m
  }
  return renew()
}

/**
 * Props para a página do remote: `{ vitral: { [name]: manifesto | null } }`.
 * Passe `vitral[name]` ao `NextRemote` em `manifest`. Com `ssr`, também
 * `vitralSsr: { [name]: html | null }`, para o `ssr` do `NextRemote`.
 */
export async function remoteProps(
  names: string | string[],
  o: RemotePropsOptions = {},
): Promise<{ vitral: Record<string, RemoteManifest | null>; vitralSsr?: Record<string, string | null> }> {
  const list = Array.isArray(names) ? names : [names]
  const found = await Promise.all(list.map((n) => remoteManifest(n, o)))
  const vitral = Object.fromEntries(list.map((n, i) => [n, found[i]]))
  if (!o.ssr) return { vitral }
  const ssr = o.ssr
  const html = await Promise.all(list.map((n, i) => (ssr[n] && found[i] ? renderRemote(n, found[i]!, ssr[n], o.timeout ?? 3000) : null)))
  return { vitral, vitralSsr: Object.fromEntries(list.map((n, i) => [n, html[i]])) }
}

/** O HTML do remote para a hidratação, ou `null` (erro ou demora). */
async function renderRemote(name: string, m: RemoteManifest, s: RemoteSsr, timeout: number): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const rendered = await Promise.race([
      Promise.resolve(s.render(s.props ?? {})),
      new Promise<never>((_, no) => (timer = setTimeout(no, timeout, new Error(`render demorou mais de ${timeout} ms`)))),
    ])
    const base = new URL(remotes[name].url, 'http://host.invalid/')
    const at = (f: string) => {
      const u = new URL(f, base)
      return u.origin === 'http://host.invalid' ? u.pathname + u.search : u.href
    }
    return ssrHolder(name, m, rendered, (m.css ?? []).map((f) => [at(f), m.files?.[f]]))
  } catch (e) {
    console.error(`[vitral] SSR do remote ${name} falhou; a página monta no navegador.`, e)
    return null
  } finally {
    clearTimeout(timer)
  }
}
