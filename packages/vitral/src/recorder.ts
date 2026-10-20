/**
 * Gravação do contrato do consumidor, no host: para cada remote montado,
 * guarda as props, os updates, os eventos que o host emitiu para ele, o que
 * ele leu de `ctx.shared` e `ctx.events.last`, e os eventos dele que o host
 * escuta. O remote reproduz o arquivo no CI com `vitral test --contract`.
 *
 * Funciona trocando métodos do protocolo global (`load` e o barramento), sem
 * nada no núcleo: o host só paga por isto quando importa `vitral/testing`.
 */
import { CONTRACT_SCHEMA, encode, type Contract, type ContractCase, type EmitPhase } from './harness'
import { protocol, type LoadedRemote } from './core/state'
import type { EventBus, MountedRemote, Props, RemoteContext, RemoteModule } from './core/types'

export interface RecordOptions {
  /** Nome do host, gravado no contrato. */
  host?: string
  /** Máximo de casos diferentes por remote. Padrão 50. */
  max?: number
}

export interface Recorder {
  /** Contratos gravados até agora, por nome do remote. */
  contracts(): Record<string, Contract>
  /** Grava `<remote>.contract.json` em `dir` (só no Node). Devolve os caminhos. */
  save(dir?: string): Promise<string[]>
  /** Para de gravar e devolve o protocolo como estava. */
  stop(): void
}

interface Live {
  props: unknown
  updates: unknown[]
  inputs: { type: string; payload?: unknown }[]
  last: Record<string, unknown>
  shared: Record<string, unknown>
  emits: { type: string; phase: EmitPhase }[]
  listens: Set<string>
  /** Fase atual: o que o remote emitir agora pode ser reproduzido. */
  phase: EmitPhase
}

/**
 * Começa a gravar. Chame antes de o host montar os remotes e de assinar
 * eventos (o recorder só vê as assinaturas feitas depois dele).
 *
 *   const rec = record({ host: 'loja' })
 *   // ...testes do host montam os remotes...
 *   await rec.save('contracts')
 *
 * Remotes em `isolate: 'iframe'` e partes (`carrinho/Mini`) não são gravados.
 */
export function record(options: RecordOptions = {}): Recorder {
  const p = protocol()
  const bus = p.events
  const { load, emit, on } = { load: p.load, emit: bus.emit, on: bus.on }
  const cases = new Map<string, Live[]>()
  const versions = new Map<string, string>()
  const hostListens = new Set<string>()
  const wrapped = new WeakMap<object, RemoteModule>()
  // Quem está chamando o barramento global agora: o remote (pelo ctx) ou o host.
  let viaRemote = 0
  let hostEmitting: boolean[] = []

  bus.on = (type: string, handler: (payload: any) => void) => {
    if (viaRemote) return on.call(bus, type, handler)
    hostListens.add(type)
    // O que o host emitir dentro do handler é do host, mesmo durante um emit do remote.
    return on.call(bus, type, (payload: unknown) => {
      const before = viaRemote
      viaRemote = 0
      try {
        handler(payload)
      } finally {
        viaRemote = before
      }
    })
  }
  bus.emit = (type, payload) => {
    hostEmitting.push(!viaRemote)
    try {
      return emit.call(bus, type, payload)
    } finally {
      hostEmitting.pop()
    }
  }

  const scope = (live: Live, events: EventBus): EventBus => ({
    emit(type, payload) {
      live.emits.push({ type, phase: live.phase })
      viaRemote++
      try {
        events.emit(type, payload)
      } finally {
        viaRemote--
      }
    },
    on(type, handler) {
      live.listens.add(type)
      viaRemote++
      try {
        return events.on(type, (payload: any) => {
          if (!hostEmitting.at(-1)) return handler(payload)
          live.inputs.push({ type, payload: encode(payload) })
          const before = live.phase
          live.phase = 'input'
          try {
            handler(payload)
          } finally {
            live.phase = before
          }
        })
      } finally {
        viaRemote--
      }
    },
    last(type) {
      const v = events.last(type)
      if (v !== undefined && !(type in live.last)) live.last[type] = encode(v)
      return v as any
    },
  })

  const sharedOf = (live: Live, api: NonNullable<RemoteContext['shared']>): NonNullable<RemoteContext['shared']> => {
    const seen = (key: string, v: unknown) => {
      if (v !== undefined && !(key in live.shared)) live.shared[key] = encode(v)
      return v
    }
    const wrap = (key: string) => {
      const h = api(key)
      return { ...h, get: () => seen(key, h.get()), subscribe: (fn: (v: any) => void) => h.subscribe((v) => fn(seen(key, v))) }
    }
    return Object.assign(wrap as any, { provide: api.provide, batch: api.batch })
  }

  const wrapModule = (mod: RemoteModule): RemoteModule => {
    let w = wrapped.get(mod)
    if (w) return w
    w = Object.create(mod, {
      mount: {
        value: async (el: HTMLElement, props: Props, ctx: RemoteContext): Promise<MountedRemote> => {
          const live: Live = { props: encode(props), updates: [], inputs: [], last: {}, shared: {}, emits: [], listens: new Set(), phase: 'mount' }
          const list = cases.get(ctx.name) ?? []
          cases.set(ctx.name, list)
          list.push(live)
          const own = { ...ctx, events: scope(live, ctx.events) }
          if (ctx.shared) own.shared = sharedOf(live, ctx.shared)
          let mounted: MountedRemote
          try {
            mounted = await mod.mount(el, props, own)
          } finally {
            live.phase = 'later'
          }
          return {
            update(next: Props) {
              live.updates.push(encode(next))
              live.phase = 'update'
              try {
                mounted.update?.(next)
              } finally {
                live.phase = 'later'
              }
            },
            unmount: () => mounted.unmount(),
          }
        },
      },
    })
    wrapped.set(mod, w!)
    return w!
  }

  p.load = (name, fetcher) =>
    load.call(p, name, fetcher).then((r: LoadedRemote) => {
      if (r.version) versions.set(r.name ?? name, r.version)
      return typeof r.module?.mount === 'function' ? { ...r, module: wrapModule(r.module) } : r
    })

  const contracts = (): Record<string, Contract> => {
    const out: Record<string, Contract> = {}
    for (const [remote, lives] of cases) {
      const unique = new Map<string, ContractCase>()
      for (const live of lives) {
        const c: ContractCase = { props: live.props as Props }
        if (live.updates.length) c.updates = live.updates as Props[]
        if (live.inputs.length) c.inputs = live.inputs
        if (Object.keys(live.last).length) c.last = live.last
        if (Object.keys(live.shared).length) c.shared = live.shared
        const emits = new Map<string, EmitPhase>()
        // Fica a primeira fase reproduzível em que o evento saiu.
        for (const e of live.emits) if (hostListens.has(e.type) && (!emits.has(e.type) || emits.get(e.type) === 'later')) emits.set(e.type, e.phase)
        if (emits.size) c.emits = [...emits].map(([type, phase]) => ({ type, phase }))
        if (live.listens.size) c.listens = [...live.listens].sort()
        const key = JSON.stringify(c)
        if (!unique.has(key) && unique.size < (options.max ?? 50)) unique.set(key, c)
      }
      out[remote] = {
        $schema: CONTRACT_SCHEMA,
        remote,
        ...(options.host && { host: options.host }),
        ...(versions.has(remote) && { version: versions.get(remote) }),
        cases: [...unique.values()],
      }
    }
    return out
  }

  return {
    contracts,
    async save(dir = '.') {
      const fs = 'node:fs/promises'
      const path = 'node:path'
      const { mkdir, writeFile } = (await import(/* @vite-ignore */ fs)) as typeof import('node:fs/promises')
      const { join } = (await import(/* @vite-ignore */ path)) as typeof import('node:path')
      await mkdir(dir, { recursive: true })
      const files: string[] = []
      for (const [name, c] of Object.entries(contracts())) {
        const file = join(dir, `${name.replace(/[^\w.-]+/g, '_')}.contract.json`)
        await writeFile(file, JSON.stringify(c, null, 2) + '\n')
        files.push(file)
      }
      return files
    },
    stop() {
      p.load = load
      bus.emit = emit
      bus.on = on
      hostEmitting = []
    },
  }
}
