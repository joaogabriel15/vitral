import type { RemoteError } from './errors'
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
  /**
   * Onde popovers, menus e dialogs devem ser renderizados (`container` do
   * Radix e do MUI, `Teleport` do Vue). No Shadow DOM é um elemento dentro do
   * shadow root, com os estilos e o tema do remote; senão, `document.body`.
   * Hosts antigos não mandam este campo.
   */
  portalContainer?: HTMLElement
  /**
   * Registro de custom elements do remote. No Shadow DOM, onde o navegador
   * tem Scoped Custom Element Registries (Chrome 146+, Safari 26+), é um
   * registro só deste remote, usado pelo shadow root e pelo elemento `el`:
   * dois remotes podem definir `<ds-button>` de versões diferentes. Sem
   * suporte, e fora do Shadow DOM, é o `customElements` global. No Shadow
   * DOM, `define` de uma tag já definida não lança: fica a definição que já
   * existe, com um aviso em dev quando ela veio de outro remote. Hosts
   * antigos não mandam este campo: use `ctx.customElements ?? customElements`.
   */
  customElements?: CustomElementRegistry
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
  /**
   * Só quando o remote roda como MCP App (`vitral({ target: 'mcp-app' })`):
   * fala JSON-RPC direto com o host MCP, para o que `events` não cobre
   * (`tools/call`, `resources/read`, `ui/request-display-mode`…).
   */
  mcp?: McpAppBridge
}

/** `ctx.mcp` de um remote empacotado como MCP App. */
export interface McpAppBridge {
  /** Pedido ao host; resolve com `result` ou rejeita com `error.message`. */
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
  /** Notificação ao host (sem resposta). */
  notify(method: string, params?: Record<string, unknown>): void
  /** O `hostContext` atual (tema, idioma, tamanho do container…), já com as mudanças. */
  hostContext(): Record<string, unknown> | undefined
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
   * O `vitral.json` já baixado (ex.: no build do host), para não buscá-lo
   * na hora. Os caminhos dele são relativos a `url`, e os hashes ficam fixos
   * no host.
   */
  manifest?: RemoteManifest
  /**
   * Faixa de versão do contrato do remote que o host aceita (ex.: `'^2'`).
   * Vence a de `configure`. Veja `VitralConfig.contract`.
   */
  contract?: string
}

/**
 * `none`: CSS com escopo. `shadow`: Shadow DOM. `iframe`: iframe com
 * `sandbox`, para código de terceiros (precisa de `enableIframe()`).
 */
export type Isolation = 'shadow' | 'none' | 'iframe'

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

/** Opções de `configure({ devOverrides })`. */
export interface DevOverrides {
  /**
   * Modelo da URL de um apelido: `?vitral=checkout@pr-123` com
   * `'https://{name}-{ref}.preview.empresa.com'` vira
   * `https://checkout-pr-123.preview.empresa.com/vitral.json`.
   */
  preview?: string
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
   * de qualquer origem. O objeto também liga e aceita `preview`, o modelo de
   * URL dos apelidos (`?vitral=checkout@pr-123`).
   */
  devOverrides?: boolean | DevOverrides
  /** Estilos do host no Shadow DOM: `{ inherit: ['/assets/base.css'] }`. */
  styles?: StyleOptions
  /** Recebe o tempo de cada etapa do carregamento (para RUM). */
  onMetric?: (metric: RemoteMetric) => void
  /**
   * Recebe cada `RemoteError` de qualquer remote (falha de download, de
   * `mount`, erro de render), uma vez só por erro, além do `onError` de cada
   * montagem. Use para mandar os erros ao seu monitoramento.
   */
  onError?: (error: RemoteError) => void
  /**
   * Atribui a um remote os erros sem tratamento (`error` e
   * `unhandledrejection` da janela) cujo topo da pilha é um arquivo dele, e
   * entrega como `RENDER_FAILED` ao `onError`. Padrão `false`.
   */
  captureGlobalErrors?: boolean
  /**
   * Dependências que o host oferece aos remotes com `dedupe`, por grupo:
   * `{ vue: { version: Vue.version, modules: { vue: Vue } } }`. O remote usa
   * a do host se a versão estiver na faixa dele; senão, a própria cópia.
   */
  dedupe?: Record<string, { version: string; modules: SharedModules }>
  /**
   * Faixa de versão do contrato que o host aceita dos remotes (ex.: `'^2'`).
   * Antes de executar o remote, o host confere a versão do `contract` do
   * manifesto e as dependências que ele espera do host; se não servir, o
   * remote não monta (`CONTRACT_MISMATCH`). Sem contrato no manifesto, nada é
   * conferido. `'*'` confere só as dependências.
   */
  contract?: string
}

/** Módulos de um grupo de `dedupe`, por especificador (`'react-dom/client'`). */
export type SharedModules = Record<string, unknown>

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
   * Componentes e módulos extras do remote (`./MiniCarrinho`, `./api`). Vêm
   * do mesmo `entry`, no export `exposes`. O host usa `carrinho/MiniCarrinho`.
   */
  exposes?: string[]
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
  /**
   * Dependências de `dedupe` do build dividido: faixa aceita, versão da
   * cópia própria e o arquivo dela, para o loader baixar junto com a entrada.
   */
  dedupe?: { name: string; range: string; version: string; file: string; chunks?: string[] }[]
  /** O que o remote declara para o host conferir antes de montar. */
  contract?: RemoteContract
  /**
   * CSS já preparado no build para o Shadow DOM. Sem este campo (manifestos
   * antigos), o runtime faz esse trabalho em cada página.
   */
  shadow?: ShadowCss
  /**
   * SBOM CycloneDX do remote (opção `sbom` do plugin): o arquivo, relativo
   * ao manifesto, e o hash dele. O runtime não usa; é para auditoria.
   */
  sbom?: { file: string; integrity: string }
}

/** Contrato do remote no `vitral.json`. */
export interface RemoteContract {
  /** Versão do contrato (opção `contract.version` do plugin). */
  version?: string
  /** Faixa aceita de cada dependência de `dedupe`, por grupo (`{ react: '^19.0.0' }`). */
  peers?: Record<string, string>
}

/**
 * CSS do remote preparado no build para `isolate: 'shadow'`. Os caminhos são
 * relativos ao primeiro arquivo de `css` (o plugin grava tudo na mesma pasta).
 */
export interface ShadowCss {
  /** Cada arquivo de `css`, na mesma ordem, sem `@import`, `@property` e `@font-face`. */
  css: string[]
  /** `@property` e `@font-face`, que só valem no documento (vão num `<link>`). */
  global?: string[]
  /** `@import` que o build não embutiu (outra origem), adotados antes de `css`. */
  imports?: string[]
  /** O CSS ainda tem `url()` relativa, que precisa apontar para o remote. */
  rebase?: boolean
}

export type Handler<T = unknown> = (payload: T) => void

export interface EventBus {
  emit<T = unknown>(type: string, payload?: T): void
  on<T = unknown>(type: string, handler: Handler<T>): () => void
  /** Último valor emitido em `type` (útil para estado como "usuário logado"). */
  last<T = unknown>(type: string): T | undefined
}

