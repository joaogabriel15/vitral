/**
 * Host universal: `<vitral-remote>` funciona em qualquer lugar que renderize
 * HTML (JS/TS puro, Angular, Svelte, Solid, Lit, Astro, Qwik, jQuery, server
 * templates…).
 *
 *   import { defineVitralElement } from 'vitral/element'
 *   defineVitralElement()
 *
 *   <vitral-remote name="carrinho" props='{"userId": 42}' isolate="shadow"
 *     inherit-styles="/assets/base.css">
 *     <p slot="fallback">Carregando…</p>
 *     <p slot="error">Indisponível</p>
 *   </vitral-remote>
 *
 *   <vitral-remote src="https://cdn.exemplo.com/carrinho/vitral.json"></vitral-remote>
 *
 * Sem os slots, mostra um carregando acessível e um erro com "Tentar de novo".
 *
 *   el.props = { userId: 43 }          // atualiza sem remontar
 *   el.addEventListener('vitral-error', (e) => e.detail.error)
 *   el.retry()
 *
 * Também exporta `elementRemote()` para publicar um Web Component (Lit,
 * Stencil, vanilla) como remote.
 */
import { createSlot, defineRemote, shared, type Isolation, type Props, type RemoteModule, type RemoteSlot, type Shared, type SlotStatus } from './index'
import { memoSelect, same } from './core/shared'
import { registerSrc } from './core/registry'

const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement

export class VitralRemoteElement extends Base {
  static observedAttributes = ['name', 'src', 'props', 'isolate']
  #slot: RemoteSlot | null = null
  #props: Props = {}

  get props(): Props {
    return this.#props
  }
  set props(value: Props) {
    this.#props = value ?? {}
    this.#slot?.update(this.#props)
  }

  get status() {
    return this.#slot?.status ?? 'loading'
  }

  retry() {
    this.#slot?.retry()
  }

  connectedCallback() {
    if (this.#slot) return
    const name = this.#name()
    if (!name) return
    if (this.hasAttribute('props') && !Object.keys(this.#props).length) this.#props = parseProps(this.getAttribute('props'))
    this.#slot = createSlot(this, {
      name,
      props: this.#props,
      isolate: (this.getAttribute('isolate') as Isolation) || undefined,
      styles: { inherit: this.getAttribute('inherit-styles')?.split(/\s+/).filter(Boolean) },
      onStatus: (status, error) => {
        this.setAttribute('data-vitral-status', status)
        if (status === 'loading') this.setAttribute('aria-busy', 'true')
        else this.removeAttribute('aria-busy')
        const has = (slot: string) => {
          const els = this.querySelectorAll<HTMLElement>(`:scope > [slot="${slot}"]`)
          for (const el of els) el.hidden = status !== (slot === 'fallback' ? 'loading' : 'error')
          return els.length > 0
        }
        // Numa microtask: o parser pode ainda não ter posto os slots próprios.
        queueMicrotask(() => {
          if (this.#slot?.status !== status) return
          const custom = { loading: has('fallback'), error: has('error'), ready: true }
          this.#showDefault(custom[status] ? null : status)
        })
        if (status === 'ready') this.dispatchEvent(new CustomEvent('vitral-ready', { bubbles: true }))
        if (status === 'error') this.dispatchEvent(new CustomEvent('vitral-error', { bubbles: true, detail: { error } }))
      },
    })
  }

  /**
   * Nome para montar. `src` em atributo é registrado sem entrar na allowlist:
   * HTML injetado não pode liberar uma origem nova quando há `allowedOrigins`.
   */
  #name(): string | null {
    const src = this.getAttribute('src')
    const name = this.getAttribute('name')
    return src ? registerSrc(src, name ?? undefined, false) : name
  }

  #default: HTMLElement | null = null

  /** Carregando e erro padrão, só quando não há slot próprio. */
  #showDefault(status: SlotStatus | null) {
    this.#default?.remove()
    this.#default = null
    if (!status) return
    const box = document.createElement('div')
    box.setAttribute('data-vitral-default', status)
    if (status === 'loading') {
      box.setAttribute('role', 'status')
      box.textContent = 'Carregando…'
    } else {
      box.setAttribute('role', 'alert')
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = 'Tentar de novo'
      button.onclick = () => this.retry()
      box.append('Não foi possível carregar. ', button)
    }
    this.prepend((this.#default = box))
  }

  disconnectedCallback() {
    // Frameworks às vezes movem o elemento no DOM; só desmonta se ele sair de vez.
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#slot?.destroy()
        this.#slot = null
        this.#showDefault(null)
      }
    })
  }

  attributeChangedCallback(attr: string, _old: string | null, value: string | null) {
    if (attr === 'props') return void (this.props = parseProps(value))
    if (!this.#slot) return void (this.isConnected && this.connectedCallback())
    if (attr === 'name' || attr === 'src') {
      const name = this.#name()
      if (name) this.#slot.set({ name })
    }
    if (attr === 'isolate') this.#slot.set({ isolate: (value as Isolation) || undefined })
  }
}

function parseProps(value: string | null): Props {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    console.error('[vitral] atributo props não é JSON válido:', value)
    return {}
  }
}

/** Registra `<vitral-remote>` (ou outro nome). Pode ser chamado mais de uma vez. */
export function defineVitralElement(tag = 'vitral-remote'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, class extends VitralRemoteElement {})
  }
}

/**
 * Publica um Web Component como remote. As props viram propriedades do
 * elemento; o contexto fica em `element.vitral`.
 *
 *   export default elementRemote('meu-widget')
 */
export function elementRemote<P extends Props = Props>(tag: string, setup?: () => void): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      setup?.()
      const node = document.createElement(tag) as HTMLElement & Record<string, unknown>
      node.vitral = ctx
      Object.assign(node, props)
      el.appendChild(node)
      return {
        update: (next) => Object.assign(node, next),
        unmount: () => node.remove(),
      }
    },
  })
}

/** O que o `SharedController` precisa do elemento (o `ReactiveControllerHost` do Lit). */
export interface SharedControllerHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void
  requestUpdate(): void
}

/**
 * Controller do Lit para uma chave compartilhada (`provide`/`shared`). Assina
 * enquanto o elemento está conectado e pede um novo render quando o valor
 * (ou o resultado do seletor) muda.
 *
 *   usuario = new SharedController(this, 'usuario')
 *   render() { return html`${this.usuario.value?.nome}` }
 */
export class SharedController<T = unknown, S = T | undefined> {
  /** Valor atual (ou o resultado do seletor). */
  value: S
  #host: SharedControllerHost
  #handle
  #select: (value: T | undefined) => S
  #pick = memoSelect()
  #off?: () => void

  constructor(host: SharedControllerHost, key: keyof Shared | (string & {}), select?: (value: T | undefined) => S) {
    this.#host = host
    this.#handle = shared<T>(key)
    this.#select = select ?? (same as (value: T | undefined) => S)
    this.value = this.#pick(this.#handle.get(), this.#select)
    host.addController(this)
  }

  hostConnected(): void {
    this.#off = this.#handle.subscribe((v) => {
      const next = this.#pick(v, this.#select)
      if (Object.is(next, this.value)) return
      this.value = next
      this.#host.requestUpdate()
    })
  }

  hostDisconnected(): void {
    this.#off?.()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vitral-remote': VitralRemoteElement
  }
}
