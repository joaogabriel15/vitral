/**
 * Remote em JS/TS puro sem escrever mount/update/unmount na mão.
 *
 *   export default component<{ mensagem?: string }>({
 *     state: { cliques: 0 },
 *     render: ({ mensagem }, state, ctx) => html`
 *       <p>${mensagem}</p>
 *       <button onclick=${() => state.cliques++}>ping ${state.cliques}</button>
 *     `,
 *   })
 *
 * Valores interpolados são escapados (sem XSS). Mudar `state` ou receber
 * props novas renderiza de novo. Funções em `on<evento>=${fn}` viram listeners.
 */
import { defineRemote, type Props, type RemoteContext, type RemoteModule } from './index'

const TEMPLATE = Symbol('vitral.html')

export interface Template {
  readonly [TEMPLATE]: true
  readonly strings: readonly string[]
  readonly values: readonly unknown[]
}

/** Template HTML seguro: tudo que é interpolado é escapado, menos outro `html`. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Template {
  return { [TEMPLATE]: true, strings, values }
}

/** Marca uma string como HTML confiável (não é escapada). Use com cuidado. */
export function unsafeHTML(markup: string): Template {
  return html(Object.assign([markup], { raw: [markup] }) as TemplateStringsArray)
}

const isTemplate = (v: unknown): v is Template => typeof v === 'object' && v !== null && TEMPLATE in v

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const EVENT_ATTR = /\s+on([a-z][\w:-]*)=(["']?)$/i
const HANDLER_PREFIX = 'data-vitral-h'

function toMarkup(value: unknown, handlers: Array<(e: Event) => void>): string {
  if (value == null || value === false) return ''
  if (Array.isArray(value)) return value.map((v) => toMarkup(v, handlers)).join('')
  if (!isTemplate(value)) return escape(String(value))
  const strings = [...value.strings]
  let out = ''
  for (let i = 0; i < strings.length; i++) {
    let s = strings[i]
    if (i < value.values.length) {
      const v = value.values[i]
      const event = typeof v === 'function' ? EVENT_ATTR.exec(s) : null
      if (event) {
        s = s.slice(0, s.length - event[0].length) + ` ${HANDLER_PREFIX}${handlers.length}="${event[1].toLowerCase()}"`
        handlers.push(v as (e: Event) => void)
        // onclick="${fn}": tira a aspa que fecha o atributo.
        if (event[2] && strings[i + 1]?.startsWith(event[2])) strings[i + 1] = strings[i + 1].slice(1)
        out += s
      } else {
        out += s + toMarkup(v, handlers)
      }
    } else {
      out += s
    }
  }
  return out
}

/** Renderiza `view` dentro de `el`, ligando os listeners declarados com `on<evento>=${fn}`. */
export function render(view: Template | string | Node, el: Element): void {
  if (typeof Node !== 'undefined' && view instanceof Node) {
    el.replaceChildren(view)
    return
  }
  const handlers: Array<(e: Event) => void> = []
  el.innerHTML = toMarkup(view, handlers)
  if (!handlers.length) return
  for (const node of el.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (!attr.name.startsWith(HANDLER_PREFIX)) continue
      node.addEventListener(attr.value, handlers[Number(attr.name.slice(HANDLER_PREFIX.length))])
      node.removeAttribute(attr.name)
    }
  }
}

export type View = Template | string | Node | null | undefined

export type RenderFn<P extends Props, S extends object> = (props: P, state: S, ctx: RemoteContext) => View

export interface ComponentOptions<P extends Props, S extends object> {
  /** Estado local. Alterar qualquer campo renderiza de novo. */
  state?: S | (() => S)
  render: RenderFn<P, S>
  /** Roda depois do primeiro render. Pode devolver uma função de limpeza. */
  mounted?(el: HTMLElement, state: S, ctx: RemoteContext): void | (() => void)
}

/**
 * Cria um remote a partir de uma função que devolve HTML. Aceita só a função
 * (`component((props) => html\`...\`)`) ou `{ state, render, mounted }`.
 */
export function component<P extends Props = Props, S extends object = Record<string, never>>(
  options: RenderFn<P, S> | ComponentOptions<P, S>,
): RemoteModule<P> {
  const opts: ComponentOptions<P, S> = typeof options === 'function' ? { render: options } : options
  return defineRemote<P>({
    mount(el, props, ctx) {
      let current = props
      let queued = false
      let alive = true
      const draw = () => {
        queued = false
        if (alive) render(opts.render(current, state, ctx) ?? '', el)
      }
      const initial = typeof opts.state === 'function' ? (opts.state as () => S)() : { ...(opts.state ?? ({} as S)) }
      const state = new Proxy(initial, {
        set(target, key, value) {
          if (!Object.is(Reflect.get(target, key), value)) {
            Reflect.set(target, key, value)
            if (!queued) {
              queued = true
              queueMicrotask(draw)
            }
          }
          return true
        },
      }) as S
      draw()
      const cleanup = opts.mounted?.(el, state, ctx)
      return {
        update(next) {
          current = next
          draw()
        },
        unmount() {
          alive = false
          cleanup?.()
          el.replaceChildren()
        },
      }
    },
  })
}
