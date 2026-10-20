/**
 * Harness de teste do remote e o contrato do consumidor.
 *
 * `harness` monta um remote com um `ctx` simulado, sem host e sem rede.
 * `verify` reproduz um contrato gravado pelo host (`record`, em
 * `./recorder`) e diz o que quebrou. Os dois rodam no navegador e no Node com
 * happy-dom ou jsdom. Nada aqui entra no host.
 */
import type { SharedApi, SharedValue } from './core/shared'
import type { EventBus, Handler, MountedRemote, Props, RemoteContext, RemoteModule } from './core/types'

/** Endereço do JSON Schema do contrato. Vai no `$schema` do arquivo gravado. */
export const CONTRACT_SCHEMA = 'https://joaogabriel15.github.io/vitral/schema/vitral-contract.json'

/**
 * Contrato do consumidor: o que um host passou para um remote e o que ele
 * espera de volta, gravado com `record()`. Arquivo `<remote>.contract.json`.
 */
export interface Contract {
  $schema?: string
  /** Nome com que o host monta o remote. */
  remote: string
  /** Quem gravou (o host). */
  host?: string
  /** `version` do manifesto do remote na gravação. */
  version?: string
  /** Uma montagem por caso, sem repetições. */
  cases: ContractCase[]
}

/** Quando o remote emitiu: no `mount`, num `update`, ao receber um evento do host, ou depois (clique, timer). */
export type EmitPhase = 'mount' | 'update' | 'input' | 'later'

/**
 * Uma montagem gravada. Valores que o JSON não guarda viram marcadores:
 * `{ "$fn": true }` (função), `{ "$date": "…" }` e `{ "$unknown": "Classe" }`.
 */
export interface ContractCase {
  /** Props do mount. */
  props: Props
  /** Props de cada `update`, em ordem. */
  updates?: Props[]
  /** Eventos que o host emitiu e o remote escutava, em ordem. */
  inputs?: { type: string; payload?: unknown }[]
  /** Valores que o remote leu com `ctx.events.last`. */
  last?: Record<string, unknown>
  /** Chaves de `ctx.shared` que o remote leu, com o primeiro valor lido. */
  shared?: Record<string, unknown>
  /** Eventos que o remote emitiu e o host escuta. */
  emits?: { type: string; phase: EmitPhase }[]
  /** Eventos que o remote assinou. */
  listens?: string[]
}

// ---------------------------------------------------------------------------
// Valores no JSON
// ---------------------------------------------------------------------------

/** Valor pronto para JSON: funções, datas e instâncias viram marcadores. */
export function encode(value: unknown, seen = new Set<object>()): unknown {
  if (typeof value === 'function') return { $fn: true }
  if (value === undefined || value === null || typeof value !== 'object') {
    return typeof value === 'bigint' || typeof value === 'symbol' ? { $unknown: typeof value } : value
  }
  if (value instanceof Date) return { $date: value.toISOString() }
  if (seen.has(value)) return { $unknown: 'circular' }
  const proto = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return { $unknown: proto?.constructor?.name ?? 'Object' }
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((v) => encode(v, seen) ?? null)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = encode(v, seen)
    return out
  } finally {
    seen.delete(value)
  }
}

/** Volta um valor gravado. `fn` cria a função que substitui cada `$fn` (o caminho é a prop). */
export function decode(value: unknown, fn: (path: string) => (...args: unknown[]) => unknown = () => () => undefined, path = ''): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v, i) => decode(v, fn, `${path}[${i}]`))
  const v = value as Record<string, unknown>
  if (v.$fn === true) return fn(path)
  if (typeof v.$date === 'string') return new Date(v.$date)
  if (typeof v.$unknown === 'string') return undefined
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x, fn, path ? `${path}.${k}` : k)]))
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

export interface HarnessOptions<P extends Props = Props> {
  props: P
  /** Nome do remote em `ctx.name`. Padrão `'remote'`. */
  name?: string
  /** Monta dentro de um shadow root (`ctx.shadowRoot` e `ctx.portalContainer` ficam nele). */
  shadow?: boolean
  /** Valores iniciais de `ctx.shared`. */
  shared?: Record<string, unknown>
  /** Valores iniciais de `ctx.events.last`. */
  last?: Record<string, unknown>
  /** Campos que substituem os do `ctx` simulado. */
  ctx?: Partial<RemoteContext>
  /** Onde montar. Padrão: um `<div>` novo no `document.body`. */
  target?: HTMLElement
}

export interface Harness<P extends Props = Props> {
  /** Elemento onde o remote montou. */
  readonly el: HTMLElement
  /** O `ctx` que o remote recebeu. */
  readonly ctx: RemoteContext
  /** Eventos que o remote emitiu por `ctx.events`, em ordem. */
  readonly events: { type: string; payload: unknown }[]
  /** Erros de `ctx.reportError` e de handlers de eventos. */
  readonly errors: unknown[]
  /** Chamadas de `ctx.navigate`. */
  readonly navigations: { url: string; options?: { replace?: boolean } }[]
  /** Tipos de evento que o remote escuta agora. */
  listens(): string[]
  /** Emite um evento como se fosse o host. */
  emit(type: string, payload?: unknown): void
  update(props: P): void
  /** Dispara `ctx.onActivate` (keep-alive). */
  activate(): void
  /** Dispara `ctx.onDeactivate` (keep-alive). */
  deactivate(): void
  unmount(): void
}

/**
 * Monta `mod` com um `ctx` simulado: barramento de eventos próprio, `shared`
 * em memória, `portalContainer`, `customElements`, `navigate` e
 * `reportError` gravados.
 *
 *   const h = await harness(remote, { props: { itens: 2 } })
 *   expect(h.el.textContent).toContain('2 itens')
 *   h.emit('tema', 'escuro')
 *   expect(h.events).toContainEqual({ type: 'carrinho:aberto', payload: undefined })
 */
export async function harness<P extends Props = Props>(
  mod: RemoteModule<P> | { default: RemoteModule<P> },
  options: HarnessOptions<P>,
): Promise<Harness<P>> {
  const remote = (typeof (mod as RemoteModule<P>).mount === 'function' ? mod : (mod as { default: RemoteModule<P> }).default) as RemoteModule<P>
  if (typeof remote?.mount !== 'function') throw new Error('[vitral] o módulo não exporta mount()')
  const name = options.name ?? 'remote'
  const target = options.target ?? document.body.appendChild(document.createElement('div'))
  const shadowRoot = options.shadow ? target.attachShadow({ mode: 'open' }) : null
  const el = document.createElement('div')
  el.setAttribute('data-vitral-root', name)
  ;(shadowRoot ?? target).appendChild(el)
  const portal = shadowRoot ? shadowRoot.appendChild(document.createElement('div')) : document.body

  const errors: unknown[] = []
  const emitted: { type: string; payload: unknown }[] = []
  const navigations: { url: string; options?: { replace?: boolean } }[] = []
  const handlers = new Map<string, Set<Handler<any>>>()
  const last = new Map<string, unknown>(Object.entries(options.last ?? {}))
  const dispatch = (type: string, payload: unknown) => {
    last.set(type, payload)
    for (const h of [...(handlers.get(type) ?? [])]) {
      try {
        h(payload)
      } catch (e) {
        errors.push(e)
      }
    }
  }
  const events: EventBus = {
    emit(type, payload) {
      emitted.push({ type, payload })
      dispatch(type, payload)
    },
    on(type, handler) {
      let set = handlers.get(type)
      if (!set) handlers.set(type, (set = new Set()))
      set.add(handler)
      return () => set!.delete(handler)
    },
    last: <T>(type: string) => last.get(type) as T | undefined,
  }
  const activate = new Set<() => void>()
  const deactivate = new Set<() => void>()
  const hook = (set: Set<() => void>) => (fn: () => void) => (set.add(fn), () => set.delete(fn))
  const ctx: RemoteContext = {
    name,
    baseUrl: typeof location !== 'undefined' ? new URL('.', location.href).href : 'http://localhost/',
    events,
    shadowRoot,
    portalContainer: portal,
    customElements,
    reportError: (e) => errors.push(e),
    navigate: (url, opts) => navigations.push({ url, options: opts }),
    protocol: 1,
    onActivate: hook(activate),
    onDeactivate: hook(deactivate),
    shared: memoryShared(options.shared ?? {}),
    ...options.ctx,
  }
  const mounted: MountedRemote<P> = await remote.mount(el, options.props, ctx)
  let alive = true
  return {
    el,
    ctx,
    events: emitted,
    errors,
    navigations,
    listens: () => [...handlers].filter(([, s]) => s.size).map(([t]) => t),
    emit: dispatch,
    update(props) {
      if (alive) mounted.update?.(props)
    },
    activate: () => activate.forEach((f) => f()),
    deactivate: () => deactivate.forEach((f) => f()),
    unmount() {
      if (!alive) return
      alive = false
      try {
        mounted.unmount()
      } finally {
        el.remove()
        if (!options.target) target.remove()
      }
    },
  }
}

/** `ctx.shared` em memória, isolado do store da página. */
function memoryShared(initial: Record<string, unknown>): SharedApi {
  const values = new Map<string, unknown>(Object.entries(initial))
  const subs = new Map<string, Set<(v: any) => void>>()
  const handle = (key: string): SharedValue<any> => {
    const set = (v: unknown) => {
      values.set(key, v)
      for (const fn of [...(subs.get(key) ?? [])]) fn(v)
    }
    return {
      key,
      get: () => values.get(key),
      set,
      update: (fn) => set(fn(values.get(key))),
      subscribe(fn) {
        fn(values.get(key))
        let s = subs.get(key)
        if (!s) subs.set(key, (s = new Set()))
        s.add(fn)
        return () => s!.delete(fn)
      },
    }
  }
  const api = handle as unknown as SharedApi
  api.provide = ((key: string, value: unknown) => {
    if (!values.has(key)) values.set(key, value)
    return handle(key)
  }) as SharedApi['provide']
  api.batch = (fn) => fn()
  return api
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  /**
   * Código do remote (o texto dos arquivos JS). Um evento que o host escuta e
   * que o remote só emite depois (clique, timer) é procurado aqui pelo nome.
   */
  sources?: string[]
  /** Quanto esperar depois de cada etapa, em ms. Padrão 0. */
  wait?: number
}

export interface VerifyResult {
  /** Casos reproduzidos. */
  cases: number
  /** O que quebra o host. Vazio quando o contrato passa. */
  failures: string[]
  /** O que mudou sem quebrar. */
  warnings: string[]
}

const message = (e: unknown) => String((e as Error)?.message ?? e)

/**
 * Reproduz cada caso de `contract` em `mod` (props, updates, eventos do host,
 * `shared` e `last`) e confere: mount, update e unmount sem erro, nenhum
 * `reportError`, e cada evento que o host escuta ainda emitido (ou, se só sai
 * depois de um clique, ainda presente no código).
 */
export async function verify(contract: Contract, mod: RemoteModule<any> | { default: RemoteModule<any> }, options: VerifyOptions = {}): Promise<VerifyResult> {
  const failures: string[] = []
  const warnings: string[] = []
  const pause = () => new Promise((r) => setTimeout(r, options.wait ?? 0))
  const cases = contract.cases ?? []
  for (const [i, c] of cases.entries()) {
    const at = `caso ${i + 1}`
    const fail = (msg: string) => failures.push(`${at}: ${msg}`)
    let h: Harness
    try {
      h = await harness(mod, {
        name: contract.remote,
        props: decode(c.props) as Props,
        shared: decode(c.shared ?? {}) as Record<string, unknown>,
        last: decode(c.last ?? {}) as Record<string, unknown>,
      })
    } catch (e) {
      fail(`erro no mount: ${message(e)}`)
      continue
    }
    await pause()
    for (const [j, u] of (c.updates ?? []).entries()) {
      try {
        h.update(decode(u) as Props)
      } catch (e) {
        fail(`erro no update ${j + 1}: ${message(e)}`)
      }
    }
    if (c.updates?.length) await pause()
    const deaf = new Set<string>()
    for (const input of c.inputs ?? []) {
      if (!h.listens().includes(input.type)) {
        if (!deaf.has(input.type)) warnings.push(`${at}: o host emite "${input.type}" e o remote não escuta mais`)
        deaf.add(input.type)
        continue
      }
      h.emit(input.type, decode(input.payload))
    }
    await pause()
    const seen = new Set(h.events.map((e) => e.type))
    for (const e of c.emits ?? []) {
      if (seen.has(e.type)) continue
      if (e.phase !== 'later') fail(`o host escuta "${e.type}" e o remote não emitiu (na gravação saiu no ${e.phase})`)
      else if (!options.sources) warnings.push(`${at}: "${e.type}" sai depois do mount; sem o código do remote, não deu para conferir`)
      else if (!options.sources.some((s) => s.includes(e.type))) fail(`o host escuta "${e.type}" e o código do remote não tem mais esse evento`)
    }
    try {
      h.unmount()
    } catch (e) {
      fail(`erro no unmount: ${message(e)}`)
    }
    for (const e of h.errors) fail(`erro reportado: ${message(e)}`)
  }
  if (!cases.length) warnings.push('contrato sem casos')
  return { cases: cases.length, failures, warnings }
}
