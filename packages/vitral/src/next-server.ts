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
import type { RemoteManifest } from './core/types'

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
  /** Tempo máximo do pedido, em ms. Padrão 3000. */
  timeout?: number
  fetch?: typeof fetch
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
 * Passe `vitral[name]` ao `NextRemote` em `manifest`.
 */
export async function remoteProps(names: string | string[], o: RemotePropsOptions = {}): Promise<{ vitral: Record<string, RemoteManifest | null> }> {
  const list = Array.isArray(names) ? names : [names]
  const found = await Promise.all(list.map((n) => remoteManifest(n, o)))
  return { vitral: Object.fromEntries(list.map((n, i) => [n, found[i]])) }
}
