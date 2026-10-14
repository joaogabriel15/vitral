import type { SharedApi } from './shared'

// Tipos públicos do contrato entre host e remote.

export type Props = Record<string, unknown>

/**
 * Props de cada remote, por nome. `npx vitral types` gera um
 * `vitral-env.d.ts` que preenche esta interface:
 *
 *   declare module 'vitral' { interface Remotes { carrinho: { userId: number } } }
 */
export interface Remotes {}

/** Props do remote `N`: as declaradas em `Remotes`, ou qualquer objeto. */
export type PropsOf<N extends string> = N extends keyof Remotes ? Remotes[N] : Props

/** Restrição extra nas props de um componente de host quando o nome está em `Remotes`. */
export type CheckedProps<N extends string> = N extends keyof Remotes ? { name?: N; props?: Remotes[N] } : { name?: N }

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
  /**
   * Com keep-alive: `fn` roda quando o remote volta para a página. Devolve a
   * função que cancela. Hosts antigos não mandam este campo.
   */
  onActivate?(fn: () => void): () => void
  /** Com keep-alive: `fn` roda quando o remote sai da página sem desmontar (pause timers e assinaturas). */
  onDeactivate?(fn: () => void): () => void
  /**
   * O mesmo `shared` de `import { shared } from 'vitral'`, mas as assinaturas
   * feitas por aqui são canceladas no unmount, e as chaves criadas com
   * `ctx.shared.provide` perdem o dono. Vem quando o host usa o store
   * (`provide`, `shared` ou um hook); senão, importe `shared` de 'vitral'.
   */
  shared?: SharedApi
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
  /**
   * O `vitral.json` já baixado (ex.: por `vitral registry`), para não buscá-lo
   * na hora. Os caminhos dele são relativos a `url`, e os hashes ficam fixos
   * no host.
   */
  manifest?: RemoteManifest
}

export type Isolation = 'shadow' | 'none'

/** Estilos do host dentro do Shadow DOM. Sem efeito no modo escopo. */
export interface StyleOptions {
  /**
   * CSS do host adotado em cada shadow root antes do CSS do remote (ex.:
   * `['/assets/base.css']`). Um `CSSStyleSheet` por arquivo, o mesmo em todos.
   */
  inherit?: string[]
  /**
   * Copia `class` e `data-theme` do `<html>` para a raiz do remote, para
   * `dark:` e `[data-theme]` funcionarem no Shadow DOM. Padrão `true`.
   */
  mirrorTheme?: boolean
}

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
  /**
   * Liga os overrides de desenvolvimento (`?vitral=nome@url` e
   * `localStorage['vitral:overrides']`) fora de localhost. Em localhost já
   * valem. Nunca ligue em produção: um link com `?vitral=` executaria código
   * de qualquer origem.
   */
  devOverrides?: boolean
  /** Estilos do host no Shadow DOM: `{ inherit: ['/assets/base.css'] }`. */
  styles?: StyleOptions
  /** Recebe o tempo de cada etapa do carregamento (para RUM). */
  onMetric?: (metric: RemoteMetric) => void
}

/**
 * Tempo de uma etapa do carregamento de um remote. Cada etapa também vira
 * `performance.measure('vitral:<nome>:<etapa>')`, visível no painel
 * Performance do DevTools.
 */
export interface RemoteMetric {
  name: string
  stage: 'manifest' | 'js' | 'css' | 'mount'
  /** Início, em ms desde `performance.timeOrigin`. */
  start: number
  duration: number
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
   * Hash SRI de cada arquivo publicado (CSS e JS do build dividido), pelo
   * caminho relativo ao manifesto.
   */
  files?: Record<string, string>
  /**
   * Build dividido, para navegadores que conferem o hash de cada módulo:
   * a entrada e os chunks que ela importa logo. `entry` e `integrity`
   * continuam apontando para o arquivo único, usado por hosts antigos e
   * quando o navegador não confere o hash por módulo.
   */
  split?: { entry: string; chunks?: string[] }
}


export type Handler<T = unknown> = (payload: T) => void

export interface EventBus {
  emit<T = unknown>(type: string, payload?: T): void
  on<T = unknown>(type: string, handler: Handler<T>): () => void
  /** Último valor emitido em `type` (útil para estado como "usuário logado"). */
  last<T = unknown>(type: string): T | undefined
}

