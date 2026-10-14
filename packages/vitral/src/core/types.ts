// Tipos públicos do contrato entre host e remote.

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
  /**
   * Versão do protocolo entre cópias da lib que o host fala (hoje 1). Use
   * para detectar recursos; hosts antigos não mandam este campo.
   */
  protocol?: number
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


/** Formato do `vitral.json` emitido pelo plugin de build. */
export interface RemoteManifest {
  name: string
  version?: string
  entry: string
  css?: string[]
  integrity?: string
  /** Escopo usado pelo plugin para prefixar o CSS (`[data-vitral-scope]`). */
  scope?: string
  /**
   * Componentes e módulos extras do remote (`./MiniCarrinho`, `./api`). Vêm
   * do mesmo `entry`, no export `exposes`. O host usa `carrinho/MiniCarrinho`.
   */
  exposes?: string[]
}


export type Handler<T = unknown> = (payload: T) => void

export interface EventBus {
  emit<T = unknown>(type: string, payload?: T): void
  on<T = unknown>(type: string, handler: Handler<T>): () => void
  /** Último valor emitido em `type` (útil para estado como "usuário logado"). */
  last<T = unknown>(type: string): T | undefined
}

