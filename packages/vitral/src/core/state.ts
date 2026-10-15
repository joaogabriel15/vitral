/**
 * Protocolo global entre cópias da lib.
 *
 * Host e remotes podem trazer cópias (e versões) diferentes do vitral. Todas
 * se encontram em `globalThis[Symbol.for('vitral')]`, um objeto pequeno e
 * estável: só métodos e o número do protocolo, nunca estruturas internas.
 * A primeira cópia a carregar instala o objeto; as outras usam os métodos
 * que conhecem. Mudanças futuras só acrescentam métodos e sobem `protocol`.
 */
import { createEventBus } from './bus'
import type { EventBus, Isolation, RemoteEntry, RemoteModule, StyleOptions } from './types'
import type { SharedStore } from './store'

export const PROTOCOL = 1

export interface Settings {
  timeout: number
  retries: number
  isolate: Isolation
  allowedOrigins: string[] | null
  /** Origens de URLs escritas no código do host (`src`). Valem mesmo com `allowedOrigins`. */
  trusted?: string[]
  /** Liga os overrides de desenvolvimento fora de localhost. */
  devOverrides?: boolean
  styles?: StyleOptions
}

/** Remote baixado e pronto para montar. Faz parte do protocolo v1. */
export interface LoadedRemote {
  module: RemoteModule
  /** URL de onde o JS veio (base para assets). */
  entry: string
  css: string[]
  isolate?: Isolation
  scope?: string
  /** Hash SRI dos arquivos do remote (CSS incluído), por URL absoluta. */
  sri?: Record<string, string>
  /** Nome que o manifesto declara (usado quando o remote veio de `src`). */
  name?: string
}

export interface Protocol {
  readonly protocol: number
  readonly events: EventBus
  settings(): Readonly<Settings>
  configure(patch: Partial<Settings>): void
  register(name: string, entry: RemoteEntry): void
  entry(name: string): RemoteEntry | undefined
  /** Origens das URLs registradas (base da allowlist padrão). */
  origins(): string[]
  /**
   * Registra uma carga de registros (ex.: `remotes.json`) ou só espera as que
   * existem. Uma carga que falhou continua falhando: o host precisa corrigir a URL.
   */
  pending(work?: Promise<unknown>): Promise<void>
  /** Baixa um remote uma vez só; falhas não ficam em cache. */
  load(name: string, fetcher: () => Promise<LoadedRemote>): Promise<LoadedRemote>
  /**
   * Store do contexto compartilhado (`provide`/`shared`). Não vem no objeto
   * criado aqui: a primeira cópia da lib que usa o store instala este método,
   * para o host mínimo não pagar por ele.
   */
  shared?(): SharedStore
}

const KEY = Symbol.for('vitral')
const g = globalThis as unknown as Record<symbol, Protocol | undefined>

function createProtocol(): Protocol {
  const settings: Settings = { timeout: 15000, retries: 1, isolate: 'none', allowedOrigins: null }
  const entries = new Map<string, RemoteEntry>()
  const modules = new Map<string, Promise<LoadedRemote>>()
  let ready: Promise<unknown> = Promise.resolve()
  return {
    protocol: PROTOCOL,
    events: createEventBus(),
    settings: () => settings,
    configure(patch) {
      Object.assign(settings, patch)
    },
    register(name, entry) {
      entries.set(name, entry)
      modules.delete(name)
    },
    entry: (name) => entries.get(name),
    origins: () => [...entries.values()].filter((e) => e.url).map((e) => new URL(e.url!).origin),
    pending(p) {
      if (p) ready = Promise.all([ready, p])
      return ready.then(() => {})
    },
    load(name, fetcher) {
      let p = modules.get(name)
      if (!p) {
        p = fetcher()
        const mine = p
        mine.catch(() => modules.get(name) === mine && modules.delete(name))
        modules.set(name, p)
      }
      return p
    },
  }
}

export function protocol(): Protocol {
  const found = g[KEY]
  if (found && typeof found.protocol === 'number' && found.protocol >= PROTOCOL) return found
  return (g[KEY] = createProtocol())
}

/** Só para testes: apaga o protocolo global. */
export function resetProtocol(): void {
  delete g[KEY]
}
