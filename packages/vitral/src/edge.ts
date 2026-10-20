/**
 * Gateway de edge: host e remotes servidos de uma origem só, com Early Hints
 * e SSR opcional dos remotes em Declarative Shadow DOM.
 *
 *   import { gateway } from 'vitral/edge'
 *
 *   const handler = gateway({
 *     origin: 'https://app.empresa.com',
 *     remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
 *   })
 *   export default { fetch: handler }            // Cloudflare Workers
 *
 * - `/_vitral/<nome>/<caminho>` vira `<pasta do remote>/<caminho>`. O
 *   `vitral.json` sai com as URLs absolutas do CDN trocadas por caminhos desta
 *   origem; os hashes de SRI ficam iguais, porque os bytes são os mesmos.
 * - O resto vai para `origin`. No HTML, `<vitral-remote src>` do CDN passa a
 *   apontar para cá, e a resposta ganha `Link: rel=modulepreload` (ou
 *   `preload`) para os remotes que a página usou da última vez.
 * - Remote com `render` sai renderizado: um `<template shadowrootmode>` com o
 *   HTML e o CSS dele dentro do `<vitral-remote>`. No cliente, o remote que
 *   exporta `hydrate` hidrata esse HTML em vez de montar de novo.
 *
 * Só usa APIs Web (`fetch`, `Request`, `Response`, streams). Usa o
 * `HTMLRewriter` quando o runtime tem (Cloudflare Workers); senão, um
 * rewriter próprio em streaming. No Node, `toNodeListener(handler)`.
 */
import type { Props, RemoteManifest } from './core/types'
import { decodeEntities, escapeAttr, rewrite, type EdgeElement } from './edge/rewriter'

export type { EdgeElement } from './edge/rewriter'

/** HTML do remote para estas props, no servidor. */
export type ServerRender = (props: Props) => string | Promise<string>

/** Isolamento do remote na página (o mesmo de `isolate` no cliente). */
export type EdgeIsolation = 'shadow' | 'none'

export interface EdgeRemote {
  /** URL do `vitral.json` (ou do JS) do remote no CDN. */
  url: string
  /**
   * SSR: devolve o HTML do remote. O mesmo `render` que o remote exporta
   * para o servidor (ex.: `import { render } from 'carrinho/server'`).
   */
  render?: ServerRender
  /** Isolamento usado no SSR quando a tag não tem `isolate`. */
  isolate?: EdgeIsolation
}

export interface GatewayOptions {
  /** Origem do host (o app que serve as páginas). */
  origin: string
  /** Remotes por nome: a URL do `vitral.json` ou a entrada completa. */
  remotes: Record<string, string | EdgeRemote>
  /** Prefixo dos caminhos dos remotes. Padrão `/_vitral/`. */
  prefix?: string
  /** Isolamento padrão do SSR (o `isolate` do `configure` do host). Padrão `'none'`. */
  isolate?: EdgeIsolation
  /** Remotes que esta URL usa, para os hints da primeira visita. */
  preload?: (url: URL) => string[]
  /** `fetch` usado para falar com o host e os CDNs. Padrão: o global. */
  fetch?: (request: Request) => Promise<Response>
  /** Por quanto tempo o gateway guarda manifestos e CSS, em ms. Padrão 60000. */
  ttl?: number
  /** Erro no SSR de um remote (a página sai sem o SSR dele). Padrão: `console.error`. */
  onError?: (error: unknown, name: string) => void
}

/** Handler do gateway: `(request) => Response`. */
export interface Gateway {
  (request: Request): Promise<Response>
  /** Valores de `Link` para esta requisição (para 103 Early Hints). */
  hints(request: Request): Promise<string[]>
}

interface Remote extends EdgeRemote {
  name: string
  /** Pasta do remote no CDN. */
  base: string
}

/** Cabeçalhos que não valem mais depois que o `fetch` decodificou o corpo. */
const STALE = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive']
const MAX_PAGES = 1000

export function gateway(options: GatewayOptions): Gateway {
  const prefix = options.prefix ?? '/_vitral/'
  const origin = new URL(options.origin)
  const send = options.fetch ?? ((r: Request) => fetch(r))
  const ttl = options.ttl ?? 60_000
  const onError = options.onError ?? ((e: unknown, name: string) => console.error(`[vitral] SSR de ${name} falhou:`, e))
  const remotes = new Map<string, Remote>()
  for (const [name, value] of Object.entries(options.remotes)) {
    const r = typeof value === 'string' ? { url: value } : value
    const url = new URL(r.url).href
    remotes.set(name, { ...r, name, url, base: new URL('.', url).href })
  }
  /** Caminho nesta origem de uma URL do CDN do remote (outras URLs ficam como estão). */
  const local = (r: Remote, abs: string) => (abs.startsWith(r.base) ? `${prefix}${encodeURIComponent(r.name)}/${abs.slice(r.base.length)}` : abs)

  const cache = new Map<string, { at: number; value: Promise<unknown> }>()
  function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>
    const value = load()
    value.catch(() => cache.get(key)?.value === value && cache.delete(key))
    cache.set(key, { at: Date.now(), value })
    return value
  }
  const get = async (url: string) => {
    const res = await send(new Request(url))
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
    return res
  }
  /** Manifesto do remote; `null` para canal (a versão é sorteada no cliente) ou JS sem manifesto. */
  const manifest = (r: Remote) =>
    cached(`m ${r.url}`, async (): Promise<RemoteManifest | null> => {
      if (!new URL(r.url).pathname.endsWith('.json')) return { name: r.name, entry: r.url }
      const m = (await (await get(r.url)).json()) as RemoteManifest & { stable?: unknown }
      return m.stable || typeof m.entry !== 'string' ? null : m
    })
  const cssText = (url: string, integrity?: string) =>
    cached(`c ${url} ${integrity ?? ''}`, async () => {
      const bytes = await (await get(url)).arrayBuffer()
      // O CSS vai inline: o navegador não confere o hash, então o gateway confere.
      if (integrity && !(await matches(bytes, integrity))) throw new Error(`integrity não confere em ${url}`)
      return new TextDecoder().decode(bytes)
    })

  // Remotes que cada caminho usou da última vez (a ordem do Map é a de uso: LRU).
  const seen = new Map<string, Map<string, EdgeIsolation>>()
  const remember = (path: string, found: Map<string, EdgeIsolation>) => {
    seen.delete(path)
    seen.set(path, found)
    if (seen.size > MAX_PAGES) seen.delete(seen.keys().next().value!)
  }

  async function hints(request: Request): Promise<string[]> {
    const url = new URL(request.url)
    if (url.pathname.startsWith(prefix)) return []
    const names = new Map(seen.get(url.pathname))
    for (const name of options.preload?.(url) ?? []) if (!names.has(name)) names.set(name, remotes.get(name)?.isolate ?? options.isolate ?? 'none')
    const links = await Promise.all([...names].map(([name, isolate]) => linksFor(name, isolate)))
    return links.flat()
  }

  async function linksFor(name: string, isolate: EdgeIsolation): Promise<string[]> {
    const r = remotes.get(name)
    const m = r && (await manifest(r).catch(() => null))
    if (!r || !m) return []
    const { abs } = paths(r, m)
    const js = m.split ? [m.split.entry, ...(m.split.chunks ?? [])] : [m.entry]
    // Remote com hash: só aquece o cache HTTP. Um modulepreload sem integrity
    // poria o módulo no mapa de módulos sem conferência.
    const hashed = !!m.integrity || Object.keys(m.files ?? {}).length > 0
    const out = js.map((u) => `<${local(r, abs(u))}>; ${hashed ? 'rel=preload; as=fetch; crossorigin=anonymous' : 'rel=modulepreload'}`)
    for (const u of m.css ?? []) out.push(`<${local(r, abs(u))}>; rel=preload; as=${isolate === 'shadow' ? 'fetch' : 'style'}; crossorigin=anonymous`)
    return out
  }

  async function asset(request: Request, url: URL): Promise<Response> {
    const rest = url.pathname.slice(prefix.length)
    const slash = rest.indexOf('/')
    const r = slash > 0 ? remotes.get(decodeURIComponent(rest.slice(0, slash))) : undefined
    const target = r && new URL(rest.slice(slash + 1) + url.search, r.base)
    // `..` no caminho não sai da pasta do remote.
    if (!r || !target!.href.startsWith(r.base)) return new Response('remote não encontrado', { status: 404 })
    const res = await send(forward(request, target!))
    if (res.status !== 200 || !target!.pathname.endsWith('.json')) return pass(res)
    const text = await res.text()
    const headers = clean(res.headers)
    let json: unknown
    try {
      json = relocate(JSON.parse(text), (s) => (/^https?:\/\//.test(s) ? local(r, s) : s))
    } catch {
      // JSON inválido: o loader do cliente mostra o erro (INVALID_MODULE).
      return new Response(text, { status: 200, headers })
    }
    headers.set('content-type', 'application/json')
    // O hash mudou junto com o texto.
    headers.delete('etag')
    return new Response(JSON.stringify(json), { status: 200, headers })
  }

  async function page(request: Request, url: URL, res: Response): Promise<Response> {
    const headers = clean(res.headers)
    for (const link of await hints(request).catch(() => [])) headers.append('link', link)
    const found = new Map<string, EdgeIsolation>()
    let ssr = false
    const element = async (el: EdgeElement) => {
      ssr = false
      const src = el.getAttribute('src')
      let r: Remote | undefined
      if (src) {
        const abs = new URL(decodeEntities(src), url).href
        for (const x of remotes.values()) if (x.url === abs || abs === new URL(local(x, x.url), url).href) r = x
        if (r && abs === r.url) el.setAttribute('src', local(r, r.url))
      } else r = remotes.get(el.getAttribute('name') ?? '')
      if (!r) return
      const isolate = (el.getAttribute('isolate') || r.isolate || options.isolate || 'none') as EdgeIsolation | 'iframe'
      if (isolate === 'iframe') return
      found.set(r.name, isolate)
      if (!r.render) return
      try {
        const m = await manifest(r)
        if (!m) return
        const props = parseProps(decodeEntities(el.getAttribute('props') ?? ''))
        // O nome no cliente: o do manifesto quando a tag usa `src`.
        const label = src ? m.name : r.name
        el.prepend(await markup(r, m, label, await r.render(props), isolate), { html: true })
        ssr = true
      } catch (e) {
        onError(e, r.name)
      }
    }
    // Com SSR, o fallback não aparece por cima do HTML pronto.
    const child = (el: EdgeElement) => {
      if (ssr && el.getAttribute('slot') === 'fallback') el.setAttribute('hidden', '')
    }
    const body = transform(res.body!, element, child).pipeThrough(
      new TransformStream({
        flush: () => remember(url.pathname, found),
      }),
    )
    return new Response(body, { status: res.status, statusText: res.statusText, headers })
  }

  async function markup(r: Remote, m: RemoteManifest, label: string, html: string, isolate: EdgeIsolation): Promise<string> {
    const { abs, sri } = paths(r, m)
    const name = escapeAttr(label)
    const scope = m.scope ? ` data-vitral-scope="${escapeAttr(m.scope)}"` : ''
    const root = `<div data-vitral-root="${name}"${scope} style="display:contents">${html}</div>`
    const css = (m.css ?? []).map(abs)
    const link = (u: string) => `<link rel="stylesheet" href="${escapeAttr(local(r, u))}" crossorigin="anonymous"${sri[u] ? ` integrity="${escapeAttr(sri[u])}"` : ''}>`
    if (isolate === 'none') return `<div data-vitral-ssr data-vitral-slot="${name}">${css.map(link).join('')}${root}</div>`
    // No Shadow DOM: o CSS preparado no build, quando há, senão o do manifesto.
    const s = m.shadow
    const files = s && css[0] ? s.css.map((u) => new URL(u, css[0]).href) : css
    const global = s && css[0] ? (s.global ?? []).map((u) => new URL(u, css[0]).href) : []
    const texts = await Promise.all(
      files.map(async (u) => {
        const text = await cssText(u, sri[u])
        // `url()` relativa valeria a partir da página: aponta para o remote.
        return s && !s.rebase ? text : text.replace(RELATIVE_URL, (_, q: string, p: string) => `url(${q}${local(r, new URL(p, u).href)}${q})`)
      }),
    )
    const style = texts.length ? `<style data-vitral-ssr>${texts.join('\n').replace(/<\/style/gi, '<\\/style')}</style>` : ''
    // `@property` e `@font-face` só valem no documento: ficam fora do shadow root.
    return `<div data-vitral-ssr data-vitral-slot="${name}">${global.map(link).join('')}<template shadowrootmode="open">${style}${root}</template></div>`
  }

  const handler = (async (request: Request) => {
    const url = new URL(request.url)
    if (url.pathname.startsWith(prefix)) return asset(request, url)
    const res = await send(forward(request, new URL(url.pathname + url.search, origin)))
    if (!res.body || !/text\/html/i.test(res.headers.get('content-type') ?? '')) return pass(res)
    return page(request, url, res)
  }) as Gateway
  handler.hints = hints
  return handler
}

const RELATIVE_URL = /url\(\s*(['"]?)(?![a-z]+:|\/\/|#)([^'")]+)\1\s*\)/gi

/** URLs absolutas e hashes (por URL absoluta) dos arquivos do manifesto. */
function paths(r: Remote, m: RemoteManifest) {
  const abs = (u: string) => new URL(u, r.url).href
  const sri: Record<string, string> = {}
  for (const file in m.files ?? {}) sri[abs(file)] = m.files![file]
  if (m.integrity) sri[abs(m.entry)] ??= m.integrity
  return { abs, sri }
}

/** Troca cada string (valores e chaves) do JSON por `fn(string)`. */
function relocate(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map((v) => relocate(v, fn))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), relocate(v, fn)]))
  return value
}

function parseProps(text: string): Props {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

/** Repassa a requisição para `target`, com corpo e cabeçalhos (menos `host`). */
function forward(request: Request, target: URL): Request {
  const headers = new Headers(request.headers)
  headers.delete('host')
  const from = new URL(request.url)
  headers.set('x-forwarded-host', from.host)
  headers.set('x-forwarded-proto', from.protocol.slice(0, -1))
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  return new Request(target, { method: request.method, headers, body, redirect: 'manual', ...(body ? { duplex: 'half' } : {}) } as RequestInit)
}

function clean(from: Headers): Headers {
  const headers = new Headers(from)
  for (const h of STALE) headers.delete(h)
  return headers
}

const pass = (res: Response) => new Response(res.body, { status: res.status, statusText: res.statusText, headers: clean(res.headers) })

type ElementHandler = (el: EdgeElement) => void | Promise<void>

declare const HTMLRewriter:
  | (new () => {
      on(selector: string, handlers: { element(el: EdgeElement): void | Promise<void> }): any
      transform(response: Response): Response
    })
  | undefined

/** `HTMLRewriter` quando o runtime tem; senão, o rewriter próprio. */
function transform(body: ReadableStream<Uint8Array>, element: ElementHandler, child: ElementHandler): ReadableStream<Uint8Array> {
  if (typeof HTMLRewriter !== 'undefined')
    return new HTMLRewriter()
      .on('vitral-remote', { element })
      .on('vitral-remote > [slot="fallback"]', { element: child })
      .transform(new Response(body, { headers: { 'content-type': 'text/html' } })).body!
  return rewrite(body, 'vitral-remote', { element, child })
}

/** Confere `integrity` (`sha256-…`, `sha384-…` ou `sha512-…`, um ou mais) nos bytes. */
async function matches(bytes: ArrayBuffer, integrity: string): Promise<boolean> {
  for (const token of integrity.trim().split(/\s+/)) {
    const [, alg, hash] = /^sha(256|384|512)-(.+)$/.exec(token) ?? []
    if (!alg) continue
    const digest = new Uint8Array(await crypto.subtle.digest(`SHA-${alg}`, bytes))
    if (btoa(String.fromCharCode(...digest)) === hash) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

/** O que `toNodeListener` usa do `IncomingMessage`. */
export interface NodeRequestLike extends AsyncIterable<Uint8Array> {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { encrypted?: boolean }
}

/** O que `toNodeListener` usa do `ServerResponse`. */
export interface NodeResponseLike {
  writeHead(status: number, headers: Record<string, string | string[]>): unknown
  write(chunk: Uint8Array): unknown
  end(chunk?: string): unknown
  writeEarlyHints?(hints: Record<string, string | string[]>): void
  headersSent?: boolean
}

/**
 * Listener de `http.createServer` para um handler `(request) => Response`.
 * Com o gateway, manda 103 Early Hints antes de buscar a página.
 *
 *   createServer(toNodeListener(gateway({ origin, remotes }))).listen(8080)
 */
export function toNodeListener(handler: ((request: Request) => Promise<Response>) | Gateway) {
  return async (req: NodeRequestLike, res: NodeResponseLike): Promise<void> => {
    try {
      const proto = req.headers['x-forwarded-proto'] ?? (req.socket?.encrypted ? 'https' : 'http')
      const url = new URL(req.url ?? '/', `${proto}://${req.headers.host ?? 'localhost'}`)
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined && !k.startsWith(':')) for (const x of [v].flat()) headers.append(k, x)
      const method = req.method ?? 'GET'
      const body =
        method === 'GET' || method === 'HEAD'
          ? undefined
          : new ReadableStream<Uint8Array>({
              async start(c) {
                for await (const chunk of req) c.enqueue(chunk)
                c.close()
              },
            })
      const request = new Request(url, { method, headers, body, ...(body ? { duplex: 'half' } : {}) } as RequestInit)
      if ('hints' in handler && res.writeEarlyHints) {
        const link = await handler.hints(request).catch(() => [])
        if (link.length) res.writeEarlyHints({ link })
      }
      const response = await handler(request)
      const out: Record<string, string | string[]> = {}
      response.headers.forEach((v, k) => (out[k] = v))
      const cookies = response.headers.getSetCookie?.() ?? []
      if (cookies.length) out['set-cookie'] = cookies
      res.writeHead(response.status, out)
      if (response.body && method !== 'HEAD') for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk)
      res.end()
    } catch (e) {
      console.error('[vitral] gateway:', e)
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('gateway: falha ao buscar a resposta')
    }
  }
}
