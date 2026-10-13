/**
 * Host universal: `<ilha-remote>` funciona em qualquer lugar que renderize
 * HTML (JS/TS puro, Angular, Svelte, Solid, Lit, Astro, Qwik, jQuery, server
 * templates…).
 *
 *   import { defineIlhaElement } from 'arquipelago/element'
 *   defineIlhaElement()
 *
 *   <ilha-remote name="carrinho" props='{"userId": 42}' isolate="shadow">
 *     <p slot="fallback">Carregando…</p>
 *     <p slot="error">Indisponível</p>
 *   </ilha-remote>
 *
 *   el.props = { userId: 43 }          // atualiza sem remontar
 *   el.addEventListener('ilha-error', (e) => e.detail.error)
 *   el.retry()
 *
 * Também exporta `elementRemote()` para publicar um Web Component (Lit,
 * Stencil, vanilla) como remote.
 */
import { createSlot, defineRemote, type Isolation, type Props, type RemoteModule, type RemoteSlot } from './index'

const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement

export class IlhaRemoteElement extends Base {
  static observedAttributes = ['name', 'props', 'isolate']
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
    const name = this.getAttribute('name')
    if (!name) return
    if (this.hasAttribute('props') && !Object.keys(this.#props).length) this.#props = parseProps(this.getAttribute('props'))
    this.#slot = createSlot(this, {
      name,
      props: this.#props,
      isolate: (this.getAttribute('isolate') as Isolation) || undefined,
      onStatus: (status, error) => {
        this.setAttribute('data-ilha-status', status)
        for (const el of this.querySelectorAll<HTMLElement>(':scope > [slot="fallback"]')) el.hidden = status !== 'loading'
        for (const el of this.querySelectorAll<HTMLElement>(':scope > [slot="error"]')) el.hidden = status !== 'error'
        if (status === 'ready') this.dispatchEvent(new CustomEvent('ilha-ready', { bubbles: true }))
        if (status === 'error') this.dispatchEvent(new CustomEvent('ilha-error', { bubbles: true, detail: { error } }))
      },
    })
  }

  disconnectedCallback() {
    // Frameworks às vezes movem o elemento no DOM; só desmonta se ele sair de vez.
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#slot?.destroy()
        this.#slot = null
      }
    })
  }

  attributeChangedCallback(attr: string, _old: string | null, value: string | null) {
    if (attr === 'props') return void (this.props = parseProps(value))
    if (!this.#slot) return void (this.isConnected && this.connectedCallback())
    if (attr === 'name' && value) this.#slot.set({ name: value })
    if (attr === 'isolate') this.#slot.set({ isolate: (value as Isolation) || undefined })
  }
}

function parseProps(value: string | null): Props {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    console.error('[ilha] atributo props não é JSON válido:', value)
    return {}
  }
}

/** Registra `<ilha-remote>` (ou outro nome). Pode ser chamado mais de uma vez. */
export function defineIlhaElement(tag = 'ilha-remote'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, class extends IlhaRemoteElement {})
  }
}

/**
 * Publica um Web Component como remote. As props viram propriedades do
 * elemento; o contexto fica em `element.ilha`.
 *
 *   export default elementRemote('meu-widget')
 */
export function elementRemote<P extends Props = Props>(tag: string, setup?: () => void): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      setup?.()
      const node = document.createElement(tag) as HTMLElement & Record<string, unknown>
      node.ilha = ctx
      Object.assign(node, props)
      el.appendChild(node)
      return {
        update: (next) => Object.assign(node, next),
        unmount: () => node.remove(),
      }
    },
  })
}

declare global {
  interface HTMLElementTagNameMap {
    'ilha-remote': IlhaRemoteElement
  }
}
