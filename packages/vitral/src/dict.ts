/**
 * `vitral/dict`: serve os remotes com dicionários de compressão
 * (Compression Dictionary Transport, RFC 9842).
 *
 * Cada `.js` e `.css` do dist sai com `Use-As-Dictionary`. No deploy seguinte,
 * o navegador pede o arquivo novo com `Available-Dictionary` (o hash do arquivo
 * antigo que ele tem em cache) e recebe só a diferença, pré-comprimida por
 * `vitral dict` em `.dcz` (zstd) ou `.dcb` (brotli).
 *
 * Só usa `Request`, `Response` e `Headers` da Web: roda em Node, Deno, Bun,
 * Cloudflare Workers e outros edges. O navegador descomprime sozinho.
 */

/** Variantes pré-comprimidas de um arquivo para um dicionário. Caminhos relativos ao dist. */
export interface DictVariant {
  dcz?: string
  dcb?: string
}

/** Um arquivo do dist no índice. */
export interface DictFile {
  /** `Content-Type` do arquivo. */
  type: string
  /** Variantes por hash do dicionário, no formato de `Available-Dictionary` (`:base64:`). */
  deltas: Record<string, DictVariant>
}

/** O `vitral-dict.json` que `vitral dict` grava no dist. */
export interface DictIndex {
  version: 1
  /** Por caminho relativo ao dist (`remote-a1b2c3d4.js`, `split/chunk-x-a1b2c3d4.js`). */
  files: Record<string, DictFile>
}

type Body = Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | string

export interface DictOptions {
  /** Conteúdo do `vitral-dict.json`. */
  index: DictIndex
  /** Lê um arquivo do dist pelo caminho relativo. `null` se não existir. */
  read: (path: string) => Body | null | undefined | Promise<Body | null | undefined>
  /** Caminho em que o dist é servido. Padrão: `/`. */
  base?: string
  /** `Cache-Control` das respostas com dicionário. Padrão: um ano, `immutable` (os nomes têm hash). */
  cacheControl?: string
}

/** Request do Node (`http.IncomingMessage`), só o que o middleware usa. */
export interface NodeRequest {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}

/** Response do Node (`http.ServerResponse`), só o que o middleware usa. */
export interface NodeResponse {
  setHeader(name: string, value: string): unknown
  writeHead(status: number, headers: Record<string, string>): unknown
  end(body?: Uint8Array | string): unknown
}

export interface Dict {
  /**
   * Responde com a variante `dcz`/`dcb` quando o navegador tem o dicionário certo.
   * `undefined`: sirva o arquivo como sempre, com os cabeçalhos de `headers()`.
   */
  fetch(request: Request): Promise<Response | undefined>
  /** `Use-As-Dictionary` e `Vary` para a resposta normal de um caminho. `undefined` se o caminho não está no índice. */
  headers(pathname: string): Record<string, string> | undefined
  /** Middleware para Node, Express e Connect: responde a variante ou põe os cabeçalhos e chama `next`. */
  node(req: NodeRequest, res: NodeResponse, next: (err?: unknown) => void): void
}

const VARY = 'Accept-Encoding, Available-Dictionary'
// Hash de 8 caracteres que o Vite põe no fim do nome: remote-BTYc3U-m.js.
const HASH = /-[\w-]{8}(\.[a-z]+)$/
// Caracteres com significado em URLPattern.
const ESPECIAIS = /[\\+*?:{}()]/g

/** Padrão de `match` para um caminho: o hash do nome vira `*`. */
export function dictMatch(pathname: string): string {
  const i = pathname.lastIndexOf('/') + 1
  const dir = pathname.slice(0, i).replace(ESPECIAIS, '\\$&')
  const name = pathname.slice(i)
  const m = HASH.exec(name)
  if (!m) return dir + name.replace(ESPECIAIS, '\\$&')
  return dir + name.slice(0, m.index).replace(ESPECIAIS, '\\$&') + '-*' + m[1]
}

/** Codificações aceitas em `Accept-Encoding` (sem as de `q=0`). */
function accepted(header: string | null | undefined): Set<string> {
  const out = new Set<string>()
  for (const part of (header ?? '').split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';')
    if (!name || params.some((p) => /^\s*q\s*=\s*0(\.0*)?\s*$/.test(p))) continue
    out.add(name.trim())
  }
  return out
}

export function createDict(o: DictOptions): Dict {
  const base = (o.base ?? '/').replace(/\/?$/, '/')
  const cacheControl = o.cacheControl ?? 'public, max-age=31536000, immutable'

  const lookup = (pathname: string) => {
    if (!pathname.startsWith(base)) return undefined
    let rel: string
    try {
      rel = decodeURIComponent(pathname.slice(base.length))
    } catch {
      return undefined
    }
    return Object.prototype.hasOwnProperty.call(o.index.files, rel) ? o.index.files[rel] : undefined
  }

  const headers = (pathname: string) => (lookup(pathname) ? { 'Use-As-Dictionary': `match="${dictMatch(pathname)}"`, Vary: VARY } : undefined)

  /** Escolhe a variante: dcz antes de dcb. */
  const choose = (pathname: string, method: string | undefined, available: string | null | undefined, encoding: string | null | undefined) => {
    if (method && method !== 'GET' && method !== 'HEAD') return undefined
    const file = lookup(pathname)
    const hash = available?.trim()
    if (!file || !hash || !Object.prototype.hasOwnProperty.call(file.deltas, hash)) return undefined
    const variant = file.deltas[hash]
    const ok = accepted(encoding)
    const enc = variant.dcz && ok.has('dcz') ? 'dcz' : variant.dcb && ok.has('dcb') ? 'dcb' : undefined
    if (!enc) return undefined
    return {
      path: variant[enc]!,
      head: {
        'Content-Type': file.type,
        'Content-Encoding': enc,
        'Cache-Control': cacheControl,
        'Use-As-Dictionary': `match="${dictMatch(pathname)}"`,
        Vary: VARY,
      },
    }
  }

  return {
    headers,
    async fetch(request) {
      const url = new URL(request.url)
      const hit = choose(url.pathname, request.method, request.headers.get('available-dictionary'), request.headers.get('accept-encoding'))
      if (!hit) return undefined
      const body = await o.read(hit.path)
      if (body == null) return undefined
      // encodeBody: o Cloudflare Workers não recomprime o corpo; outros runtimes ignoram.
      const init = { headers: hit.head, encodeBody: 'manual' } as ResponseInit
      return new Response(request.method === 'HEAD' ? null : (body as BodyInit), init)
    },
    node(req, res, next) {
      const pathname = new URL(req.url ?? '/', 'http://x').pathname
      const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(',') : v)
      const hit = choose(pathname, req.method, one(req.headers['available-dictionary']), one(req.headers['accept-encoding']))
      if (!hit) {
        const h = headers(pathname)
        if (h) for (const [k, v] of Object.entries(h)) res.setHeader(k, v)
        return next()
      }
      Promise.resolve(o.read(hit.path))
        .then(async (body) => {
          if (body == null) {
            const h = headers(pathname)!
            for (const [k, v] of Object.entries(h)) res.setHeader(k, v)
            return next()
          }
          const bytes = typeof body === 'string' || body instanceof Uint8Array ? body : new Uint8Array(await new Response(body as BodyInit).arrayBuffer())
          res.writeHead(200, hit.head)
          res.end(req.method === 'HEAD' ? undefined : bytes)
        })
        .catch(next)
    },
  }
}
