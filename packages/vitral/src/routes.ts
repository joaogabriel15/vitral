/**
 * Composição por rota, para um host sem framework (app shell):
 *
 *   import { routes } from 'vitral/routes'
 *   routes({ '/checkout/*': 'checkout', '/conta/*': 'conta', '/': 'inicio', '*': 'nao-encontrado' })
 *
 *   <vitral-outlet isolate="shadow">
 *     <p slot="fallback">Carregando…</p>
 *     <p slot="error">Indisponível</p>
 *     <p slot="empty">Página não encontrada</p>
 *   </vitral-outlet>
 *
 * O `<vitral-outlet>` monta o remote da URL atual e troca de remote quando a
 * rota muda (`navigate()`, voltar/avançar e links). Navegar dentro do mesmo
 * remote não remonta: o roteador do próprio remote cuida disso.
 */
import { createSlot, navigate, type Isolation, type Props, type RemoteSlot } from './index'

/** Padrão de URL → nome do remote. A primeira rota que bate vence. */
export type Routes = Record<string, string>

export interface RoutesOptions {
  /**
   * Links `<a href>` da mesma origem que batem com uma rota navegam sem
   * recarregar a página (via `navigate()`). Padrão: true.
   */
  links?: boolean
}

export interface RouteMatch {
  /** Nome do remote. */
  name: string
  /** Padrão que bateu. */
  pattern: string
  /** Segmentos `:nome` do padrão. */
  params: Record<string, string>
}

let table: Routes = {}
const outlets = new Set<VitralOutletElement>()
const compiled = new Map<string, RegExp>()

function compile(pattern: string): RegExp {
  let re = compiled.get(pattern)
  if (!re) {
    const body = pattern
      .replace(/\/\*$|^\*$/, '\0')
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')
      .replace(/\/$/, '')
      .replace('\0', '(?:/.*)?')
    compiled.set(pattern, (re = new RegExp(`^${body}/?$`)))
  }
  return re
}

/**
 * Remote da rota que bate com `path`, ou `null`. Padrões: `/conta` (exato),
 * `/checkout/*` (o prefixo e tudo abaixo dele), `/produto/:id` e `*` (qualquer).
 */
export function matchRoute(path: string, routes: Routes = table): RouteMatch | null {
  for (const [pattern, name] of Object.entries(routes)) {
    const m = compile(pattern).exec(path)
    if (m) return { name, pattern, params: { ...m.groups } }
  }
  return null
}

/**
 * Define as rotas, registra `<vitral-outlet>` e, com `links` (padrão), faz os
 * links internos navegarem sem recarregar. Devolve a função que desfaz tudo.
 */
export function routes(map: Routes, options: RoutesOptions = {}): () => void {
  table = map
  defineVitralOutlet()
  for (const o of outlets) o.sync()
  const intercept = options.links !== false && typeof document !== 'undefined'
  if (intercept) document.addEventListener('click', onClick)
  return () => {
    if (intercept) document.removeEventListener('click', onClick)
    if (table === map) table = {}
    for (const o of outlets) o.sync()
  }
}

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  // composedPath enxerga links dentro de Shadow DOM.
  const a = e.composedPath().find((n): n is HTMLAnchorElement => (n as Element).localName === 'a' && !!(n as HTMLAnchorElement).href)
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
  const url = new URL(a.href)
  if (url.origin !== location.origin || !matchRoute(url.pathname)) return
  e.preventDefault()
  navigate(url.href)
}

const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement

export class VitralOutletElement extends Base {
  static observedAttributes = ['props', 'isolate']
  #slot: RemoteSlot | null = null
  #props: Props = {}
  // `undefined` até a primeira checagem, para o estado `empty` aparecer já de início.
  #route: string | null | undefined

  get props(): Props {
    return this.#props
  }
  set props(value: Props) {
    this.#props = value ?? {}
    this.#slot?.update(this.#props)
  }

  /** Remote montado agora, ou `null`. */
  get route(): string | null {
    return this.#route ?? null
  }

  get status() {
    return this.#slot?.status ?? (this.#route ? 'loading' : 'empty')
  }

  retry() {
    this.#slot?.retry()
  }

  #onNavigate = () => this.sync()

  connectedCallback() {
    outlets.add(this)
    addEventListener('popstate', this.#onNavigate)
    ;(globalThis as any).navigation?.addEventListener('navigatesuccess', this.#onNavigate)
    this.sync()
  }

  disconnectedCallback() {
    outlets.delete(this)
    removeEventListener('popstate', this.#onNavigate)
    ;(globalThis as any).navigation?.removeEventListener('navigatesuccess', this.#onNavigate)
    // Frameworks às vezes movem o elemento no DOM; só desmonta se ele sair de vez.
    queueMicrotask(() => !this.isConnected && this.#show(null))
  }

  attributeChangedCallback(attr: string, _old: string | null, value: string | null) {
    if (attr === 'props') {
      try {
        this.props = value ? JSON.parse(value) : {}
      } catch {
        console.error('[vitral] atributo props não é JSON válido:', value)
      }
    } else this.#slot?.set({ isolate: (value as Isolation) || undefined })
  }

  /** Confere a URL atual e troca de remote se a rota mudou. */
  sync() {
    if (this.isConnected) this.#show(matchRoute(location.pathname)?.name ?? null)
  }

  #show(name: string | null) {
    if (name === this.#route) return
    this.#route = name
    if (name) this.setAttribute('data-vitral-route', name)
    else this.removeAttribute('data-vitral-route')
    if (!name) {
      this.#slot?.destroy()
      this.#slot = null
      this.#status('empty', null)
    } else if (this.#slot) {
      this.#slot.set({ name })
    } else {
      this.#slot = createSlot(this, {
        name,
        props: this.#props,
        isolate: (this.getAttribute('isolate') as Isolation) || undefined,
        onStatus: (s, e) => this.#status(s, e),
      })
    }
  }

  #status(status: string, error: unknown) {
    this.setAttribute('data-vitral-status', status)
    for (const [slot, on] of [['fallback', 'loading'], ['error', 'error'], ['empty', 'empty']]) {
      for (const el of this.querySelectorAll<HTMLElement>(`:scope > [slot="${slot}"]`)) el.hidden = status !== on
    }
    if (status === 'ready') this.dispatchEvent(new CustomEvent('vitral-ready', { bubbles: true, detail: { route: this.#route } }))
    if (status === 'error') this.dispatchEvent(new CustomEvent('vitral-error', { bubbles: true, detail: { error } }))
  }
}

/** Registra `<vitral-outlet>` (ou outro nome). `routes()` já chama. */
export function defineVitralOutlet(tag = 'vitral-outlet'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, class extends VitralOutletElement {})
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vitral-outlet': VitralOutletElement
  }
}
