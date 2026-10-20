/**
 * Rewriter de HTML em streaming, para runtimes sem `HTMLRewriter` (Node, Deno,
 * Bun). Faz só o que o gateway precisa: acha as tags de abertura de alguns
 * elementos (`<vitral-remote>`, `<vitral-outlet>`) e dos filhos diretos deles, deixa ler e trocar
 * atributos e inserir HTML logo depois da tag. O resto passa como veio.
 *
 * Ignora comentários e o conteúdo de `<script>`, `<style>`, `<textarea>` e
 * `<title>`. Não monta árvore: dentro do elemento, conta a profundidade pelas
 * tags de abertura e fechamento (elementos vazios, como `<img>`, não contam).
 */

/** O subconjunto do `Element` do `HTMLRewriter` que o gateway usa. */
export interface EdgeElement {
  readonly tagName: string
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  /** Insere conteúdo logo depois da tag de abertura. */
  prepend(content: string, options?: { html?: boolean }): void
}

export interface RewriteHandlers {
  /** Cada `<tag>` (a raiz). Pode ser assíncrono: o stream espera. */
  element(el: EdgeElement): void | Promise<void>
  /** Cada filho direto de `<tag>`. */
  child?(el: EdgeElement): void
}

const RAW = new Set(['script', 'style', 'textarea', 'title'])
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

/** Entidades em atributos: o `HTMLRewriter` também devolve o texto cru. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|quot|amp|lt|gt|apos|#39);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : Number(k.slice(1)))
    return ({ quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" } as Record<string, string>)[k]
  })
}

export const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Tag de abertura editável. `toString()` devolve a tag (com as mudanças) e o que foi inserido. */
class Tag implements EdgeElement {
  // Valor cru (como veio, igual ao `HTMLRewriter`) e se foi trocado.
  #attrs: [name: string, value: string | null, set?: boolean][] = []
  #changed = false
  #after = ''
  constructor(
    readonly tagName: string,
    private raw: string,
  ) {
    const inner = raw.slice(1 + tagName.length, raw.endsWith('/>') ? -2 : -1)
    for (const m of inner.matchAll(ATTR)) this.#attrs.push([m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? null])
  }
  getAttribute(name: string) {
    const a = this.#attrs.find(([k]) => k === name)
    return a ? (a[1] ?? '') : null
  }
  hasAttribute(name: string) {
    return this.getAttribute(name) !== null
  }
  setAttribute(name: string, value: string) {
    this.#changed = true
    const a = this.#attrs.find(([k]) => k === name)
    if (a) (a[1] = value), (a[2] = true)
    else this.#attrs.push([name, value, true])
  }
  prepend(content: string, options?: { html?: boolean }) {
    // Como no HTMLRewriter: cada prepend entra antes dos anteriores.
    this.#after = (options?.html ? content : escapeAttr(content).replace(/>/g, '&gt;')) + this.#after
  }
  toString() {
    const tag = this.#changed
      ? `<${this.tagName}${this.#attrs.map(([k, v, set]) => (v === null ? ` ${k}` : ` ${k}="${set ? escapeAttr(v) : v.replace(/"/g, '&quot;')}"`)).join('')}${this.raw.endsWith('/>') ? ' /' : ''}>`
      : this.raw
    return tag + this.#after
  }
}

/**
 * Reescreve `body` em streaming. `tags` são os nomes dos elementos procurados
 * (minúsculos). Os bytes que não são tags de interesse saem sem mudança.
 */
export function rewrite(body: ReadableStream<Uint8Array>, tags: string | string[], handlers: RewriteHandlers): ReadableStream<Uint8Array> {
  const wanted = new Set([tags].flat())
  // O elemento de interesse em que o parser está (para achar o fechamento dele).
  let tag = ''
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buf = ''
  let raw: string | null = null
  // Profundidade dentro de `tag`: -1 fora; 0 entre a abertura e um filho direto.
  let depth = -1

  async function process(out: TransformStreamDefaultController<Uint8Array>, end: boolean) {
    let text = ''
    let i = 0
    const flush = () => text && (out.enqueue(encoder.encode(text)), (text = ''))
    for (;;) {
      const lt = buf.indexOf('<', i)
      if (lt < 0) {
        text += buf.slice(i)
        i = buf.length
        break
      }
      text += buf.slice(i, lt)
      i = lt
      if (raw) {
        const close = buf.slice(lt, lt + raw.length + 2).toLowerCase()
        if (close.length < raw.length + 2 && !end) break
        if (close === `</${raw}`) raw = null
        else {
          text += '<'
          i = lt + 1
          continue
        }
      }
      // `<!-` partido no fim do pedaço: espera o resto.
      if (!end && buf.length - lt < 4 && '<!--'.startsWith(buf.slice(lt))) break
      if (buf.startsWith('<!--', lt)) {
        const stop = buf.indexOf('-->', lt + 4)
        if (stop < 0) {
          if (!end) break
          text += buf.slice(lt)
          i = buf.length
          break
        }
        text += buf.slice(lt, stop + 3)
        i = stop + 3
        continue
      }
      const m = /^<(\/?)([a-zA-Z][^\s/>]*)/.exec(buf.slice(lt, lt + 64))
      if (!m) {
        // `</` partido: ainda pode virar tag de fechamento.
        if (buf.length - lt < 3 && !end) break
        text += '<'
        i = lt + 1
        continue
      }
      const close = findTagEnd(buf, lt)
      if (close < 0) {
        if (!end) break
        text += buf.slice(lt)
        i = buf.length
        break
      }
      const source = buf.slice(lt, close + 1)
      i = close + 1
      const name = m[2].toLowerCase()
      if (m[1]) {
        if (depth > 0 && !VOID.has(name)) depth--
        else if (depth === 0 && name === tag) depth = -1
        text += source
        continue
      }
      if (RAW.has(name)) raw = name
      const selfClosing = source.endsWith('/>') || VOID.has(name)
      if (depth < 0 && wanted.has(name)) {
        tag = name
        const el = new Tag(name, source)
        const r = handlers.element(el)
        if (r) flush(), await r
        text += el
        if (!selfClosing) depth = 0
        continue
      }
      if (depth === 0 && handlers.child) {
        const el = new Tag(name, source)
        handlers.child(el)
        text += el
      } else text += source
      if (depth >= 0 && !selfClosing) depth++
    }
    buf = buf.slice(i)
    flush()
  }

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      async transform(chunk, out) {
        buf += decoder.decode(chunk, { stream: true })
        await process(out, false)
      },
      async flush(out) {
        buf += decoder.decode()
        await process(out, true)
        if (buf) out.enqueue(encoder.encode(buf))
      },
    }),
  )
}

/** Fim da tag que começa em `start` (o `>` fora de aspas), ou -1 se ainda não chegou. */
function findTagEnd(s: string, start: number): number {
  let quote = ''
  for (let i = start + 1; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '>') return i
  }
  return -1
}
