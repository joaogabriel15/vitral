/**
 * vitral: micro-frontends com um único contrato.
 *
 * Um remote é um módulo ES que exporta `mount(el, props, ctx)` e devolve
 * `{ update?, unmount }`. O host só precisa saber a URL. Nada de config
 * compartilhada em tempo de build, nada de container global de dependências.
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type Props = Record<string, unknown>

export interface RemoteContext {
  /** Nome com que o host registrou este remote. */
  name: string
  /** URL base de onde o remote foi carregado (útil para assets). */
  baseUrl: string
  /**
   * Barramento de eventos compartilhado entre host e todos os remotes. As
   * assinaturas feitas por aqui são canceladas sozinhas no unmount.
   */
  events: EventBus
  /** Shadow root quando o host pediu isolamento, senão `null`. */
  shadowRoot: ShadowRoot | null
  /** Avisa o host de um erro em tempo de execução (os adaptadores já chamam). */
  reportError(error: unknown): void
  /** Navega a página inteira (host e todos os roteadores) para `url`. */
  navigate(url: string, options?: { replace?: boolean }): void
}

export interface MountedRemote<P extends Props = Props> {
  update?(props: P): void
  unmount(): void
}

export interface RemoteModule<P extends Props = Props> {
  mount(el: HTMLElement, props: P, ctx: RemoteContext): MountedRemote<P> | Promise<MountedRemote<P>>
}

export interface RemoteEntry {
  /** URL do módulo JS do remote, ou do `vitral.json` gerado pelo plugin. */
  url?: string
  /**
   * Remote local, sem rede: o próprio módulo ou uma função que o importa
   * (ex.: `() => import('./carrinho')`). Útil em monorepos e testes.
   */
  module?: RemoteModule<any> | (() => Promise<RemoteModule<any> | { default: RemoteModule<any> }>)
  /** Hash SRI (`sha256-…`, `sha384-…`, `sha512-…`) do JS. Verificado antes de executar. */
  integrity?: string
  /** CSS extra para carregar junto. */
  css?: string[]
  /** Isolamento padrão para este remote. */
  isolate?: Isolation
}

export type Isolation = 'shadow' | 'none'

export interface VitralConfig {
  /** Mapa nome → URL (ou entrada completa), ou a URL de um JSON com esse mapa. */
  remotes?: Record<string, string | RemoteEntry> | string
  /**
   * Origens de onde é permitido carregar código. Padrão: a própria origem da
   * página mais as origens das URLs registradas. Use `['*']` para liberar tudo.
   */
  allowedOrigins?: string[]
  /** Tempo máximo para baixar um remote, em ms. Padrão 15000. */
  timeout?: number
  /** Tentativas extras se o download falhar. Padrão 1. */
  retries?: number
  /** Isolamento padrão para todos os remotes. Padrão `'none'`. */
  isolate?: Isolation
}

export type RemoteErrorCode =
  | 'NOT_REGISTERED'
  | 'ORIGIN_BLOCKED'
  | 'TIMEOUT'
  | 'INTEGRITY'
  | 'INVALID_MODULE'
  | 'LOAD_FAILED'
  | 'MOUNT_FAILED'
  | 'RENDER_FAILED'

export class RemoteError extends Error {
  constructor(
    public code: RemoteErrorCode,
    public remote: string,
    message: string,
    public cause?: unknown,
  ) {
    super(`[vitral] ${remote}: ${message}`)
    this.name = 'RemoteError'
  }
}

/** Formato do `vitral.json` emitido pelo plugin de build. */
export interface RemoteManifest {
  name: string
  version?: string
  entry: string
  css?: string[]
  integrity?: string
  /** Escopo usado pelo plugin para prefixar o CSS (`[data-vitral-scope]`). */
  scope?: string
}

// ---------------------------------------------------------------------------
// Estado global (compartilhado mesmo que host e remotes tenham cópias da lib)
// ---------------------------------------------------------------------------

interface ResolvedEntry {
  entry: string
  css: string[]
  integrity?: string
  isolate?: Isolation
  scope?: string
}

interface GlobalState {
  config: Required<Omit<VitralConfig, 'remotes' | 'allowedOrigins'>> & { allowedOrigins: string[] | null }
  entries: Map<string, RemoteEntry>
  remotesSource: Promise<void> | null
  modules: Map<string, Promise<{ mod: RemoteModule; resolved: ResolvedEntry }>>
  events: EventBus
}

const KEY = Symbol.for('vitral.state.v1')
const g = globalThis as unknown as Record<symbol, GlobalState>

function state(): GlobalState {
  return (g[KEY] ??= {
    config: { timeout: 15000, retries: 1, isolate: 'none', allowedOrigins: null },
    entries: new Map(),
    remotesSource: null,
    modules: new Map(),
    events: createEventBus(),
  })
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/** Configura a lib. Pode ser chamada mais de uma vez; as opções são mescladas. */
export function configure(config: VitralConfig): void {
  const s = state()
  const { remotes, allowedOrigins, ...rest } = config
  Object.assign(s.config, rest)
  if (allowedOrigins) s.config.allowedOrigins = allowedOrigins
  if (typeof remotes === 'string') {
    const url = absolute(remotes)
    s.remotesSource = fetchJson<Record<string, string | RemoteEntry>>(url, s.config.timeout, 'remotes', 'no-cache').then((map) =>
      registerAll(map, url),
    )
  } else if (remotes) {
    registerAll(remotes)
  }
}

/** Registra (ou substitui) um remote. */
export function register(name: string, entry: string | RemoteEntry): void {
  const s = state()
  const e: RemoteEntry = typeof entry === 'string' ? { url: entry } : entry
  if (!e.url && !e.module) throw new RemoteError('NOT_REGISTERED', name, 'informe url ou module')
  s.entries.set(name, e.url ? { ...e, url: absolute(e.url) } : e)
  s.modules.delete(name)
}

function registerAll(map: Record<string, string | RemoteEntry>, base?: string) {
  for (const [name, entry] of Object.entries(map)) {
    const e: RemoteEntry = typeof entry === 'string' ? { url: entry } : entry
    register(name, e.url ? { ...e, url: absolute(e.url, base) } : e)
  }
}

// ---------------------------------------------------------------------------
// Carregamento
// ---------------------------------------------------------------------------

/** Baixa (uma vez só) e devolve o módulo de um remote. */
export function loadRemote<P extends Props = Props>(name: string): Promise<RemoteModule<P>> {
  return loadResolved(name).then((r) => r.mod as unknown as RemoteModule<P>)
}

/** Começa a baixar um remote sem montar (ex.: no hover de um link). */
export function preload(name: string): void {
  loadResolved(name).catch(() => {})
}

function loadResolved(name: string) {
  const s = state()
  let p = s.modules.get(name)
  if (!p) {
    p = (async () => {
      if (s.remotesSource) await s.remotesSource
      const entry = s.entries.get(name)
      if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
      if (entry.module) return loadLocal(name, entry)
      const resolved = await resolveEntry(name, entry as RemoteEntry & { url: string })
      const mod = await withRetry(s.config.retries, () => importModule(name, resolved))
      return { mod, resolved }
    })().catch((e) => {
      throw e instanceof RemoteError ? e : new RemoteError('LOAD_FAILED', name, String(e?.message ?? e), e)
    })
    // Falhas não ficam em cache: a próxima tentativa baixa de novo.
    p.catch(() => s.modules.get(name) === p && s.modules.delete(name))
    s.modules.set(name, p)
  }
  return p
}

async function loadLocal(name: string, entry: RemoteEntry) {
  let mod: any = entry.module
  if (typeof mod === 'function') mod = await mod()
  mod = mod?.default ?? mod
  if (typeof mod?.mount !== 'function') throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount()')
  const resolved: ResolvedEntry = { entry: typeof location !== 'undefined' ? location.href : 'http://localhost/', css: entry.css ?? [], isolate: entry.isolate }
  return { mod: mod as RemoteModule, resolved }
}

async function resolveEntry(name: string, entry: RemoteEntry & { url: string }): Promise<ResolvedEntry> {
  checkOrigin(name, entry.url)
  const isManifest = new URL(entry.url).pathname.endsWith('.json')
  if (!isManifest) {
    return { entry: entry.url, css: (entry.css ?? []).map((c) => absolute(c, entry.url)), integrity: entry.integrity, isolate: entry.isolate }
  }
  // O manifesto é o único arquivo sem hash no nome: sempre revalida, para
  // nunca usar um deploy velho (o resto pode ter cache eterno).
  const m = await fetchJson<RemoteManifest>(entry.url, state().config.timeout, name, 'no-cache')
  if (!m || typeof m.entry !== 'string') throw new RemoteError('INVALID_MODULE', name, `manifesto inválido em ${entry.url}`)
  const resolved = {
    entry: absolute(m.entry, entry.url),
    css: [...(m.css ?? []), ...(entry.css ?? [])].map((c) => absolute(c, entry.url)),
    // A integridade declarada pelo host vence a do manifesto.
    integrity: entry.integrity ?? m.integrity,
    isolate: entry.isolate,
    scope: m.scope,
  }
  checkOrigin(name, resolved.entry)
  return resolved
}

async function importModule(name: string, r: ResolvedEntry): Promise<RemoteModule> {
  const { timeout } = state().config
  let url = r.entry
  let revoke: string | null = null
  if (r.integrity) {
    const code = await fetchText(url, timeout, name)
    await verifyIntegrity(name, code, r.integrity)
    // Executa exatamente os bytes verificados.
    url = revoke = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  }
  try {
    const ns = await withTimeout(timeout, name, import(/* @vite-ignore */ /* webpackIgnore: true */ url))
    const mod = (ns.default ?? ns) as RemoteModule
    if (typeof mod?.mount !== 'function') {
      throw new RemoteError('INVALID_MODULE', name, 'o módulo não exporta mount(). Use defineRemote() no remote.')
    }
    return mod
  } catch (e) {
    if (e instanceof RemoteError) throw e
    throw new RemoteError('LOAD_FAILED', name, `falha ao importar ${r.entry}`, e)
  } finally {
    if (revoke) URL.revokeObjectURL(revoke)
  }
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export interface MountOptions {
  isolate?: Isolation
  /** Chamado quando o remote quebra depois de montado (erro de render, handler etc.). */
  onError?: (error: RemoteError) => void
}

/**
 * Monta um remote dentro de `target`. Devolve um handle com `update` e
 * `unmount` que funciona igual para qualquer framework.
 */
export async function mountRemote<P extends Props = Props>(
  target: HTMLElement,
  name: string,
  props: P,
  options: MountOptions = {},
): Promise<MountedRemote<P>> {
  const { mod, resolved } = await loadResolved(name)
  const isolate = options.isolate ?? resolved.isolate ?? state().config.isolate

  // Cada montagem ganha seu próprio elemento. Assim duas montagens no mesmo
  // alvo (ex.: StrictMode do React) nunca disputam o mesmo DOM.
  let shadowRoot: ShadowRoot | null = null
  const el = document.createElement('div')
  el.setAttribute('data-vitral-root', name)
  if (resolved.scope) el.setAttribute('data-vitral-scope', resolved.scope)
  el.style.display = 'contents'
  if (isolate === 'shadow') {
    shadowRoot = target.shadowRoot ?? target.attachShadow({ mode: 'open' })
    shadowRoot.appendChild(el)
  } else {
    target.appendChild(el)
  }
  await injectCss(resolved.css, shadowRoot)

  const scoped = scopedEvents()
  const ctx: RemoteContext = {
    name,
    baseUrl: new URL('.', resolved.entry).href,
    events: scoped.bus,
    shadowRoot,
    reportError(e) {
      const err = e instanceof RemoteError ? e : new RemoteError('RENDER_FAILED', name, String((e as Error)?.message ?? e), e)
      if (options.onError) options.onError(err)
      else console.error(err)
    },
    navigate,
  }
  let mounted: MountedRemote
  try {
    mounted = await mod.mount(el, props, ctx)
  } catch (e) {
    scoped.dispose()
    el.remove()
    throw new RemoteError('MOUNT_FAILED', name, 'erro ao montar', e)
  }
  let alive = true
  return {
    update(next: P) {
      if (alive) mounted.update?.(next)
    },
    unmount() {
      if (!alive) return
      alive = false
      try {
        mounted.unmount()
      } finally {
        scoped.dispose()
        el.remove()
      }
    },
  }
}

const loadedCss = new WeakMap<Document | ShadowRoot, Map<string, Promise<void>>>()
const cssText = new Map<string, Promise<CSSStyleSheet | null>>()
const hoistedProps = new Set<string>()

function injectCss(urls: string[], root: ShadowRoot | null): Promise<unknown> {
  if (root && typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
    return injectShadowCss(urls, root)
  }
  const owner = root ?? document
  let seen = loadedCss.get(owner)
  if (!seen) loadedCss.set(owner, (seen = new Map()))
  const parent = root ?? document.head
  return Promise.all(
    urls.map((href) => {
      let p = seen!.get(href)
      if (!p) {
        p = new Promise<void>((resolve) => {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = href
          link.crossOrigin = 'anonymous'
          // CSS quebrado não deve impedir o remote de aparecer.
          link.onload = link.onerror = () => resolve()
          parent.appendChild(link)
        })
        seen!.set(href, p)
      }
      return p
    }),
  )
}

/**
 * CSS dentro de Shadow DOM. `@property` (usado pelo Tailwind v4 em sombras,
 * rings, gradientes, transforms…) é ignorado dentro de shadow roots, então
 * essas regras sobem para o documento e o resto vira um stylesheet adotado.
 */
function injectShadowCss(urls: string[], root: ShadowRoot): Promise<unknown> {
  return Promise.all(urls.map(loadSheet)).then((sheets) => {
    const add = sheets.filter((s): s is CSSStyleSheet => !!s && !root.adoptedStyleSheets.includes(s))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...add]
  })
}

function loadSheet(href: string): Promise<CSSStyleSheet | null> {
  let p = cssText.get(href)
  if (!p) {
    p = fetch(href, { credentials: 'omit' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        const props: string[] = []
        const rest = text.replace(/@property\s+(--[\w-]+)\s*\{[^}]*\}/g, (rule, prop: string) => {
          if (!hoistedProps.has(prop)) {
            hoistedProps.add(prop)
            props.push(rule)
          }
          return ''
        })
        if (props.length) {
          const style = document.createElement('style')
          style.setAttribute('data-vitral-properties', '')
          style.textContent = props.join('\n')
          document.head.appendChild(style)
        }
        const sheet = new CSSStyleSheet()
        // URLs relativas (fontes, imagens) continuam apontando para o remote.
        sheet.replaceSync(rest.replace(/url\(\s*(['"]?)(?![a-z]+:|\/|#)([^'")]+)\1\s*\)/gi, (_, q, u) => `url(${q}${new URL(u, href).href}${q})`))
        return sheet
      })
      .catch(() => null)
    cssText.set(href, p)
  }
  return p
}

// ---------------------------------------------------------------------------
// Controlador de slot (base dos componentes de host de qualquer framework)
// ---------------------------------------------------------------------------

export type SlotStatus = 'loading' | 'ready' | 'error'

export interface SlotOptions<P extends Props = Props> {
  name: string
  props?: P
  isolate?: Isolation
  /** Chamado a cada mudança de estado (para mostrar fallback / erro). */
  onStatus?: (status: SlotStatus, error: RemoteError | null) => void
}

export interface RemoteSlot<P extends Props = Props> {
  /** Atualiza as props sem remontar. */
  update(props: P): void
  /** Troca de remote ou de isolamento (remonta). */
  set(options: Partial<Pick<SlotOptions<P>, 'name' | 'isolate'>>): void
  /** Remonta do zero (botão "tentar de novo"). */
  retry(): void
  destroy(): void
  readonly status: SlotStatus
}

/**
 * Cuida do ciclo de vida de um remote dentro de `target`: monta, atualiza,
 * remonta ao trocar de nome, ignora respostas atrasadas e limpa tudo no fim.
 * Os adaptadores de host (Web Component, Svelte, Solid, Preact…) usam isto.
 */
export function createSlot<P extends Props = Props>(target: HTMLElement, options: SlotOptions<P>): RemoteSlot<P> {
  let { name, isolate } = options
  let props = (options.props ?? {}) as P
  let handle: MountedRemote<P> | null = null
  let holder: HTMLElement | null = null
  let token = 0
  let status: SlotStatus = 'loading'

  const setStatus = (s: SlotStatus, e: RemoteError | null = null) => {
    status = s
    if (holder) holder.style.display = s === 'error' ? 'none' : ''
    options.onStatus?.(s, e)
  }

  const teardown = () => {
    handle?.unmount()
    handle = null
    holder?.remove()
    holder = null
  }

  const mount = () => {
    const my = ++token
    teardown()
    // Um elemento novo por montagem: shadow roots e DOM antigos nunca são reusados.
    holder = document.createElement('div')
    holder.setAttribute('data-vitral-slot', name)
    target.appendChild(holder)
    setStatus('loading')
    const fail = (e: unknown) => {
      if (my !== token) return
      setStatus('error', e instanceof RemoteError ? e : new RemoteError('MOUNT_FAILED', name, String(e), e))
    }
    const initial = props
    mountRemote<P>(holder, name, props, { isolate, onError: fail }).then((h) => {
      if (my !== token) return h.unmount()
      handle = h
      // Props que mudaram enquanto o remote baixava.
      if (props !== initial) h.update?.(props)
      setStatus('ready')
    }, fail)
  }

  mount()
  return {
    update(next) {
      props = next
      handle?.update?.(next)
    },
    set(next) {
      const changed = (next.name !== undefined && next.name !== name) || ('isolate' in next && next.isolate !== isolate)
      if (next.name !== undefined) name = next.name
      if ('isolate' in next) isolate = next.isolate
      if (changed) mount()
    },
    retry: mount,
    destroy() {
      token++
      teardown()
    },
    get status() {
      return status
    },
  }
}

// ---------------------------------------------------------------------------
// Lado do remote
// ---------------------------------------------------------------------------

/** Declara um remote. É só uma função identidade com tipos. */
export function defineRemote<P extends Props = Props>(remote: RemoteModule<P>): RemoteModule<P> {
  return remote
}

// ---------------------------------------------------------------------------
// Eventos entre micro-frontends
// ---------------------------------------------------------------------------

export type Handler<T = unknown> = (payload: T) => void

export interface EventBus {
  emit<T = unknown>(type: string, payload?: T): void
  on<T = unknown>(type: string, handler: Handler<T>): () => void
  /** Último valor emitido em `type` (útil para estado como "usuário logado"). */
  last<T = unknown>(type: string): T | undefined
}

export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<Handler<any>>>()
  const lastValues = new Map<string, unknown>()
  return {
    emit(type, payload) {
      lastValues.set(type, payload)
      for (const h of [...(handlers.get(type) ?? [])]) {
        try {
          h(payload)
        } catch (e) {
          console.error(`[vitral] handler de "${type}" falhou`, e)
        }
      }
    },
    on(type, handler) {
      let set = handlers.get(type)
      if (!set) handlers.set(type, (set = new Set()))
      set.add(handler)
      return () => set!.delete(handler)
    },
    last<T>(type: string) {
      return lastValues.get(type) as T | undefined
    },
  }
}

/** Barramento global. É o mesmo objeto que os remotes recebem em `ctx.events`. */
export const events: EventBus = {
  emit: (t, p) => state().events.emit(t, p),
  on: (t, h) => state().events.on(t, h),
  last: (t) => state().events.last(t),
}

/** Visão do barramento que cancela todas as assinaturas de uma vez. */
function scopedEvents(): { bus: EventBus; dispose(): void } {
  const offs = new Set<() => void>()
  return {
    bus: {
      emit: (t, p) => events.emit(t, p),
      last: (t) => events.last(t),
      on(t, h) {
        const off = events.on(t, h)
        const wrapped = () => (offs.delete(wrapped), off())
        offs.add(wrapped)
        return wrapped
      },
    },
    dispose() {
      for (const off of [...offs]) off()
    },
  }
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

/**
 * Navega mantendo todos os roteadores em sincronia (React Router, Vue Router,
 * Next, Nuxt…): atualiza o histórico e dispara `popstate`, que todos escutam.
 */
export function navigate(url: string, options: { replace?: boolean } = {}): void {
  const target = new URL(url, location.href)
  if (target.origin !== location.origin) {
    location.assign(target.href)
    return
  }
  if (options.replace) history.replaceState(history.state, '', target.href)
  else history.pushState(history.state, '', target.href)
  dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
  events.emit('vitral:navigate', target.pathname + target.search + target.hash)
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function pageOrigin(): string | null {
  return typeof location !== 'undefined' ? location.origin : null
}

function absolute(url: string, base?: string): string {
  return new URL(url, base ?? (typeof location !== 'undefined' ? location.href : undefined)).href
}

function checkOrigin(name: string, url: string) {
  const s = state()
  const origin = new URL(url).origin
  let allowed = s.config.allowedOrigins
  if (!allowed) {
    allowed = [pageOrigin(), ...[...s.entries.values()].filter((e) => e.url).map((e) => new URL(e.url!).origin)].filter(Boolean) as string[]
  }
  if (allowed.includes('*') || allowed.includes(origin) || url.startsWith('blob:')) return
  throw new RemoteError('ORIGIN_BLOCKED', name, `origem ${origin} não está em allowedOrigins`)
}

async function withRetry<T>(retries: number, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      const retryable = e instanceof RemoteError && (e.code === 'LOAD_FAILED' || e.code === 'TIMEOUT')
      if (!retryable || i >= retries) throw e
      await new Promise((r) => setTimeout(r, 200 * 2 ** i))
    }
  }
}

function withTimeout<T>(ms: number, name: string, p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new RemoteError('TIMEOUT', name, `não respondeu em ${ms}ms`)), ms)
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    )
  })
}

async function fetchText(url: string, timeout: number, name: string, cache?: RequestCache): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', cache })
    if (!res.ok) throw new RemoteError('LOAD_FAILED', name, `HTTP ${res.status} em ${url}`)
    return await res.text()
  } catch (e) {
    if (e instanceof RemoteError) throw e
    if (ctrl.signal.aborted) throw new RemoteError('TIMEOUT', name, `não respondeu em ${timeout}ms`)
    throw new RemoteError('LOAD_FAILED', name, `falha ao baixar ${url}`, e)
  } finally {
    clearTimeout(t)
  }
}

async function fetchJson<T>(url: string, timeout: number, name: string, cache?: RequestCache): Promise<T> {
  const text = await fetchText(url, timeout, name, cache)
  try {
    return JSON.parse(text) as T
  } catch (e) {
    throw new RemoteError('INVALID_MODULE', name, `JSON inválido em ${url}`, e)
  }
}

async function verifyIntegrity(name: string, code: string, integrity: string) {
  const [algo, expected] = integrity.split('-', 2) as [string, string]
  const algos: Record<string, string> = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }
  if (!algos[algo] || !expected) throw new RemoteError('INTEGRITY', name, `formato de integrity inválido: ${integrity}`)
  const digest = await crypto.subtle.digest(algos[algo], new TextEncoder().encode(code))
  const actual = btoa(String.fromCharCode(...new Uint8Array(digest)))
  if (actual !== expected) throw new RemoteError('INTEGRITY', name, 'o hash do código não confere com integrity')
}

/** Só para testes: limpa todo o estado global. */
export function __reset(): void {
  delete g[KEY]
}
