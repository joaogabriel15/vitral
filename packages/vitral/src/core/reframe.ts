/**
 * `isolate: 'reframe'`: o JS do remote roda num iframe oculto, de mesma
 * origem; o DOM fica num shadow root no host. Fica num módulo à parte,
 * baixado só por quem usa.
 *
 * - O iframe é `about:blank` com `display:none`. Um `document.open()` feito
 *   pela página dá a ele a URL da página: `location` e `history` do remote
 *   começam iguais aos do host e seguem sincronizados (Navigation API onde
 *   existe, `popstate` sempre).
 * - O `document` do iframe é corrigido: buscas vão para o shadow root,
 *   `createElement` cria no documento do host (com o registro de custom
 *   elements do remote), `head` e `body` são elementos dentro do shadow root.
 * - Eventos de `window` e `document` vão para os do host; tamanho da janela,
 *   `matchMedia` e rolagem também. Os ouvintes saem no unmount.
 * - O JS passa pelo mesmo resolvedor do loader (allowlist, manifesto,
 *   contrato, canal). Com integrity, os bytes são conferidos aqui e o iframe
 *   executa exatamente esses bytes via `blob:` (o caminho 3 do SRI).
 *
 * Não é fronteira de segurança: o iframe é da mesma origem e alcança
 * `parent`. Para código de terceiros, use `isolate: 'iframe'`.
 */
import { prefetchCss } from './css'
import { isRemoteError, RemoteError, report } from './errors'
import { splitName } from './expose'
import { verifyIntegrity } from './integrity'
import { resolveEntry } from './loader'
import { protocol, type LoadedRemote } from './state'
import type { MountedRemote, Props, RemoteContext, RemoteEntry, RemoteModule } from './types'
import { fetchBytes, metric, withRetry, withTimeout } from './util'

/**
 * Script inline do iframe. Com CSP sem `'unsafe-inline'`, libere o hash dele
 * (`script-src 'sha256-…'`) ou use nonce: o vitral copia o do primeiro
 * `<script nonce>` da página.
 */
export const REFRAME_SCRIPT = 'window.__vitral=function(u){return import(u)}'

// Eventos que pertencem à janela do remote; os outros vão para a do host.
const OWN = /^(popstate|hashchange|message|messageerror|error|unhandledrejection|rejectionhandled)$/
// Leitura da janela que no iframe oculto daria zero.
const VIEW = ['innerWidth', 'innerHeight', 'outerWidth', 'outerHeight', 'devicePixelRatio', 'scrollX', 'scrollY', 'pageXOffset', 'pageYOffset', 'screenX', 'screenY', 'visualViewport']
const VIEW_FNS = ['matchMedia', 'scrollTo', 'scroll', 'scrollBy', 'getComputedStyle', 'getSelection']
const DOC_FNS = ['createElementNS', 'createTextNode', 'createComment', 'createDocumentFragment', 'createEvent', 'createRange', 'createTreeWalker', 'createNodeIterator', 'createAttribute', 'importNode', 'adoptNode', 'getSelection']

type Win = Window & typeof globalThis & { __vitral?: (url: string) => Promise<any> }

/** Valor próprio (método trocado) em `o`. */
const set = (o: object, values: Record<string, unknown>) => {
  for (const k in values) Object.defineProperty(o, k, { configurable: true, writable: true, value: values[k] })
}
/** Getter próprio em `o`. */
const get = (o: object, getters: Record<string, () => unknown>) => {
  for (const k in getters) Object.defineProperty(o, k, { configurable: true, get: getters[k] })
}

/**
 * Resolve o remote, cria o iframe, corrige `window`/`document` dele e
 * importa o JS lá dentro. Devolve um remote pronto para o `mountRemote`,
 * cujo `mount` liga o `document` do iframe ao shadow root da montagem.
 */
export async function load(name: string, _isolate?: unknown, priority?: RequestPriority): Promise<LoadedRemote> {
  const p = protocol()
  const { timeout, retries } = p.settings()
  const [remote, key] = splitName(name)
  let resolved: Omit<LoadedRemote, 'module'> | undefined
  let realm: Realm | undefined
  try {
    const entry = p.entry(remote)
    if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
    if (!entry.url) throw new RemoteError('MOUNT_FAILED', name, "remote local (module) não roda com isolate: 'reframe': registre a URL dele")
    let t = performance.now()
    const { integrity, ...r } = await resolveEntry(remote, entry as RemoteEntry & { url: string }, priority)
    delete r.split
    resolved = r
    metric(name, 'manifest', t)
    // O CSS baixa junto com o JS, como no Shadow DOM.
    prefetchCss(r, true, priority)
    t = performance.now()
    // Com integrity, só roda o que foi conferido: os bytes do arquivo único.
    const bytes =
      integrity &&
      (await withRetry(retries, async () => {
        const b = await fetchBytes(r.entry, timeout, name, { priority })
        await verifyIntegrity(name, b, integrity)
        return b
      }))
    const url = bytes ? URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' })) : r.entry
    // O mesmo registro de custom elements que o shadow root vai usar.
    const { registryFor } = await import('./shadow')
    realm = createRealm(r.name ?? name, registryFor(r.name ?? name))
    let ns: any
    try {
      ns = await withTimeout(timeout, name, realm.load(url))
    } catch (e) {
      throw isRemoteError(e) ? e : new RemoteError('LOAD_FAILED', name, `falha ao importar ${r.entry}`, e)
    } finally {
      if (bytes) URL.revokeObjectURL(url)
    }
    if (key) {
      const part = ns?.exposes?.[key]
      if (!part) throw new RemoteError('NOT_EXPOSED', name, `${remote} não expõe ${key}`)
      ns = typeof part === 'function' ? await part() : part
    }
    const mod: RemoteModule = ns?.default ?? ns
    if (typeof mod?.mount != 'function') throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount()')
    metric(name, 'js', t)
    const own = realm
    return { ...r, module: { mount: (el, props, ctx) => own.mount(mod, el, props, ctx) } }
  } catch (e: any) {
    realm?.dispose()
    throw report(isRemoteError(e) ? e : new RemoteError('LOAD_FAILED', name, String(e?.message ?? e), e), resolved)
  }
}

/** `isolate: 'iframe'` sem `enableIframe()`. Mora aqui para o texto do erro ficar fora do host mínimo. */
export function noFrames(_target: HTMLElement, name: string): Promise<never> {
  return Promise.reject(new RemoteError('MOUNT_FAILED', name, 'isolate="iframe" precisa de enableIframe(), de vitral/iframe'))
}

interface Realm {
  load(url: string): Promise<any>
  mount(mod: RemoteModule, el: HTMLElement, props: Props, ctx: RemoteContext): Promise<MountedRemote>
  dispose(): void
}

function createRealm(name: string, registry: CustomElementRegistry): Realm {
  const host = document
  const frame = host.createElement('iframe')
  frame.setAttribute('data-vitral-reframe', name)
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.display = 'none'
  host.body.appendChild(frame)
  const w = frame.contentWindow as Win
  const d = w.document
  d.open()
  d.close()
  const realHead = d.head
  const inFrame = d.createElement.bind(d)
  const script = d.createElement('script')
  script.nonce = host.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''
  script.textContent = REFRAME_SCRIPT
  realHead.appendChild(script)
  const load = w.__vitral
  delete w.__vitral

  // `head` do remote: um elemento no shadow root (antes do mount, solto).
  const head = host.createElement('div')
  head.setAttribute('data-vitral-head', '')
  head.hidden = true
  let root: ShadowRoot | null = null
  let body: HTMLElement = head
  let ctx: RemoteContext | null = null
  const scope = (): ParentNode => root ?? head
  const ctrl = new AbortController()

  // Ouvintes no host com o `signal` da montagem: saem todos no unmount.
  const listen = (target: EventTarget, own: EventTarget | null) => {
    const add = own?.addEventListener
    const remove = own?.removeEventListener
    return {
      addEventListener(type: string, fn: any, o?: boolean | AddEventListenerOptions) {
        if (own && OWN.test(type)) return add!.call(own, type, fn, o)
        const opts = typeof o == 'object' ? o : { capture: !!o }
        const signal = opts.signal && (AbortSignal as any).any ? (AbortSignal as any).any([opts.signal, ctrl.signal]) : ctrl.signal
        target.addEventListener(type, fn, { ...opts, signal })
      },
      removeEventListener(type: string, fn: any, o?: boolean | EventListenerOptions) {
        if (own && OWN.test(type)) return remove!.call(own, type, fn, o)
        target.removeEventListener(type, fn, o)
      },
    }
  }

  // Elementos com o registro de custom elements do remote, quando ele é próprio.
  const scoped = Object.getPrototypeOf(registry) !== customElements
  const createElement = (tag: string, o?: ElementCreationOptions) => {
    // Script inserido pelo remote roda no iframe, não na página.
    if (/^script$/i.test(tag)) return inFrame(tag)
    if (scoped && !(o as any)?.customElementRegistry)
      try {
        return host.createElement(tag, { ...o, customElementRegistry: registry } as ElementCreationOptions)
      } catch {}
    return host.createElement(tag, o)
  }
  const fromHost: Record<string, unknown> = {}
  for (const k of DOC_FNS) fromHost[k] = (host as any)[k].bind(host)
  set(d, {
    ...fromHost,
    ...listen(host, null),
    createElement,
    querySelector: (s: string) => scope().querySelector(s),
    querySelectorAll: (s: string) => scope().querySelectorAll(s),
    getElementById: (id: string) => scope().querySelector(`#${CSS.escape(id)}`),
    getElementsByClassName: (c: string) => scope().querySelectorAll(c.trim().split(/\s+/).map((x) => '.' + CSS.escape(x)).join('')),
    getElementsByTagName: (t: string) => scope().querySelectorAll(t),
    getElementsByName: (n: string) => scope().querySelectorAll(`[name="${CSS.escape(n)}"]`),
    elementFromPoint: (x: number, y: number) => (root ?? host).elementFromPoint(x, y),
    elementsFromPoint: (x: number, y: number) => (root ?? host).elementsFromPoint(x, y),
  })
  get(d, {
    head: () => head,
    body: () => body,
    documentElement: () => host.documentElement,
    activeElement: () => root?.activeElement ?? host.body,
  })
  // `<script>` posto no `head` ou no `body` do remote vai para o iframe.
  const redirect = (el: HTMLElement) => {
    const append = el.appendChild
    const before = el.insertBefore
    set(el, {
      appendChild: <T extends Node>(n: T) => (n.nodeName == 'SCRIPT' ? realHead.appendChild(n) : append.call(el, n)),
      insertBefore: <T extends Node>(n: T, ref: Node | null) => (n.nodeName == 'SCRIPT' ? realHead.appendChild(n) : before.call(el, n, ref)),
    })
  }
  redirect(head)

  const view: Record<string, () => unknown> = {}
  for (const k of VIEW) view[k] = () => (window as any)[k]
  get(w, view)
  const viewFns: Record<string, unknown> = {}
  for (const k of VIEW_FNS) viewFns[k] = (window as any)[k].bind(window)
  set(w, { ...viewFns, ...listen(window, w), HTMLElement, customElements: registry })

  // Erros que escapam do código do remote caem na janela dele.
  w.addEventListener('error', (e) => ctx?.reportError(e.error ?? e.message))
  w.addEventListener('unhandledrejection', (e) => ctx?.reportError(e.reason))

  // Histórico: o do remote segue o do host, e o que o remote faz chega ao host.
  const h = w.history
  const push = h.pushState
  const replace = h.replaceState
  const go = (fn: History['pushState'], method: 'pushState' | 'replaceState') => (state: unknown, title: string, url?: string | URL | null) => {
    fn.call(h, state, title, url)
    const href = w.location.href
    if (href === location.href) return
    history[method](state, '', href)
    dispatchEvent(new PopStateEvent('popstate', { state }))
    protocol().events.emit('vitral:navigate', location.pathname + location.search + location.hash)
  }
  set(h, { pushState: go(push, 'pushState'), replaceState: go(replace, 'replaceState') })
  const pull = () => {
    const old = w.location.href
    if (old === location.href) return
    // Navegador que não deu ao iframe a URL da página: o remote fica sem sincronia, mas monta.
    try {
      replace.call(h, history.state, '', location.href)
    } catch {
      return
    }
    w.dispatchEvent(new w.PopStateEvent('popstate', { state: history.state }))
    if (old.split('#')[1] !== location.href.split('#')[1]) w.dispatchEvent(new w.HashChangeEvent('hashchange', { oldURL: old, newURL: location.href }))
  }
  addEventListener('popstate', pull, { signal: ctrl.signal })
  ;(globalThis as any).navigation?.addEventListener('currententrychange', pull, { signal: ctrl.signal })

  const dispose = () => {
    ctx = null
    ctrl.abort()
    head.remove()
    frame.remove()
  }

  return {
    load: (url) => {
      if (!load) throw new RemoteError('LOAD_FAILED', name, "a CSP bloqueou o script do iframe do isolate: 'reframe' (libere o hash de REFRAME_SCRIPT ou use nonce)")
      return load(url)
    },
    async mount(mod, el, props, c) {
      ctx = c
      root = c.shadowRoot
      if (root) root.prepend(head)
      body = c.portalContainer ?? el
      if (body !== head) redirect(body)
      pull()
      let handle: MountedRemote
      try {
        handle = await mod.mount(el, props, c)
      } catch (e) {
        dispose()
        throw e
      }
      return {
        update: (next) => handle.update?.(next),
        unmount() {
          try {
            handle.unmount()
          } finally {
            dispose()
          }
        },
      }
    },
    dispose,
  }
}
