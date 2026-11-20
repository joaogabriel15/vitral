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
import { warmSsr } from './core/loader'
import { matchRoute as match, type RouteMatch, type Routes } from './core/match'
import { whenShared } from './core/wait'
import { createSlot, navigate, type Isolation, type Props, type RemoteError, type RemoteSlot, type SlotStatus } from './index'

export type { RouteMatch, Routes }

export interface RoutesOptions {
  /**
   * Links `<a href>` da mesma origem que batem com uma rota navegam sem
   * recarregar a página (via `navigate()`). Padrão: true.
   */
  links?: boolean
  /**
   * Depois de trocar de remote numa navegação: anuncia a página nova ao
   * leitor de tela (o `h1` do remote ou o `document.title`) e move o foco
   * para o `h1`. Sem isso, o foco fica no link clicado e quem usa leitor de
   * tela não sabe que a página mudou. Padrão: true.
   */
  announce?: boolean
}

let table: Routes = {}
let announce = true
const outlets = new Set<VitralOutletElement>()

/**
 * Remote da rota que bate com `path`, ou `null`. Padrões: `/conta` (exato),
 * `/checkout/*` (o prefixo e tudo abaixo dele), `/produto/:id` e `*` (qualquer).
 */
export function matchRoute(path: string, routes: Routes = table): RouteMatch | null {
  return match(path, routes)
}

/**
 * Define as rotas, registra `<vitral-outlet>` e, com `links` (padrão), faz os
 * links internos navegarem sem recarregar. Devolve a função que desfaz tudo.
 */
export function routes(map: Routes, options: RoutesOptions = {}): () => void {
  table = map
  announce = options.announce !== false
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

/** Primeiro `h1` dentro de `root`, procurando também nos shadow roots. */
function heading(root: ParentNode): HTMLElement | null {
  const h = root.querySelector<HTMLElement>('h1')
  if (h) return h
  for (const el of root.querySelectorAll('*')) {
    const inner = el.shadowRoot && heading(el.shadowRoot)
    if (inner) return inner
  }
  return null
}

let announcer: HTMLElement | undefined

/**
 * Anuncia a página que está em `container` ao leitor de tela e põe o foco no
 * `h1` dela (ou no próprio `container`). O `<vitral-outlet>` chama depois de
 * cada troca de remote; hosts com outro roteador chamam no `vitral-ready`.
 */
export function announceRoute(container: HTMLElement): void {
  const h = heading(container)
  const text = h?.textContent?.trim() || document.title
  if (!announcer?.isConnected) {
    announcer = document.createElement('div')
    announcer.setAttribute('data-vitral-announcer', '')
    announcer.setAttribute('aria-live', 'assertive')
    announcer.setAttribute('aria-atomic', 'true')
    announcer.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0'
    document.body.appendChild(announcer)
  }
  // Texto vazio e depois o novo: o leitor anuncia mesmo se o título repetir.
  announcer.textContent = ''
  setTimeout(() => (announcer!.textContent = text), 50)
  const target = h ?? container
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement

export class VitralOutletElement extends Base {
  static observedAttributes = ['props', 'isolate']
  #slot: RemoteSlot | null = null
  /** Cancela a espera do `wait-for`. */
  #wait = () => {}
  #props: Props = {}
  // `undefined` até a primeira checagem, para o estado `empty` aparecer já de início.
  #route: string | null | undefined
  /** A troca atual veio de uma navegação (não da primeira carga): anuncia quando montar. */
  #navigated = false

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

  #onNavigate = () => {
    const before = this.#route
    this.sync()
    // Navegação dentro do mesmo remote: o roteador dele cuida do foco.
    if (this.#route !== before && this.#route) this.#navigated = true
  }

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
    this.#wait()
    if (!name) {
      this.#slot?.destroy()
      this.#slot = null
      this.#status('empty', null)
    } else if (this.#slot) {
      this.#slot.set({ name })
    } else {
      // `wait-for="sessao"`: monta quando as chaves de `provide` tiverem valor.
      const waitFor =
        this.getAttribute('wait-for')
          ?.split(/[\s,]+/)
          .filter(Boolean) ?? []
      const options = {
        name,
        props: this.#props,
        isolate: (this.getAttribute('isolate') as Isolation) || undefined,
        waitFor,
        onStatus: (s: SlotStatus, e: RemoteError | null) => this.#status(s, e),
      }
      // HTML da rota renderizado pelo gateway (`vitral/edge` com `routes`): hidrata, sob demanda.
      const ssr = this.querySelector<HTMLElement>(':scope>[data-vitral-ssr]')
      if (ssr?.getAttribute('data-vitral-slot') === name) {
        this.#status('loading', null)
        warmSsr(ssr)
        import('./core/hydrate').then((m) => {
          if (this.#route === name && !this.#slot) this.#slot = m.hydrateSlot(this, ssr, { ...options, props: this.#props })
          else ssr.remove()
        })
        return
      }
      ssr?.remove()
      if (waitFor.length) this.#status('loading', null)
      this.#wait = whenShared(waitFor, () => {
        if (this.#route === name && !this.#slot) this.#slot = createSlot(this, { ...options, name, props: this.#props })
      })
    }
  }

  #status(status: string, error: unknown) {
    this.setAttribute('data-vitral-status', status)
    for (const [slot, on] of [['fallback', 'loading'], ['error', 'error'], ['empty', 'empty']]) {
      for (const el of this.querySelectorAll<HTMLElement>(`:scope > [slot="${slot}"]`)) el.hidden = status !== on
    }
    if (status === 'ready' && this.#navigated && announce) {
      // Um quadro depois: o remote já desenhou o título.
      requestAnimationFrame(() => this.isConnected && announceRoute(this))
    }
    if (status !== 'loading') this.#navigated = false
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
