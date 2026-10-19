/**
 * Remotes do Module Federation no host vitral, para migrar um remote por vez:
 *
 *   import { federationRemote } from 'vitral/federation'
 *   import { reactRemote } from 'vitral/react'
 *
 *   configure({
 *     remotes: {
 *       carrinho: federationRemote('https://cdn.empresa.com/carrinho/mf-manifest.json', {
 *         adapt: (m) => reactRemote(m.default),
 *       }),
 *     },
 *   })
 *
 *   <Remote name="carrinho/Carrinho" props={{ userId: 42 }} />
 *
 * Lê o `mf-manifest.json`, carrega o `remoteEntry.js` (global ou ES module),
 * chama `init` com as dependências que o host oferece e `get` de cada parte
 * exposta. Fica fora do host mínimo: só entra no bundle de quem importa.
 */
import type { RemoteEntry, RemoteModule, SharedModules } from './core/types'

export interface FederationOptions {
  /**
   * Parte montada por `<Remote name="carrinho">` (sem `/`), como `'./Carrinho'`.
   * Padrão: a única parte do manifesto. As outras são `carrinho/Parte`.
   */
  expose?: string
  /**
   * Transforma o módulo exposto num remote com `mount`, ex.:
   * `(m) => reactRemote(m.default)`. Recebe também a chave (`'./Carrinho'`).
   * Devolver `undefined` deixa o módulo como está (módulo sem UI). Sem
   * `adapt`, a parte precisa exportar `mount` (ou um `default` com `mount`).
   */
  adapt?: (module: any, key: string) => RemoteModule<any> | undefined
  /**
   * Dependências que o host oferece ao remote, no mesmo formato do `dedupe`
   * do `configure`: `{ react: { version: React.version, modules: { react: React, 'react-dom': ReactDOM } } }`.
   * Cada especificador entra no share scope do Module Federation com a
   * versão do grupo. O remote usa a do host se servir; senão, a própria cópia.
   */
  shared?: Record<string, { version: string; modules: SharedModules }>
  /**
   * Sem manifesto (URL de um `remoteEntry.js`): nome da variável global que o
   * container cria (`library.type: 'var'`). Sem esta opção, a URL é importada
   * como ES module.
   */
  global?: string
  /**
   * Origens de onde o `remoteEntry.js` pode vir, além da origem do manifesto
   * (o `publicPath` do manifesto pode apontar para outro CDN). `['*']` libera tudo.
   */
  allowedOrigins?: string[]
}

/** A parte do `mf-manifest.json` que o adaptador lê. */
export interface FederationManifest {
  name?: string
  metaData?: {
    globalName?: string
    publicPath?: string
    getPublicPath?: string
    remoteEntry?: { name: string; path?: string; type?: string }
  }
  exposes?: { name?: string; path: string }[]
}

/** O container do Module Federation (`remoteEntry.js`). */
interface Container {
  init(scope: Record<string, unknown>): unknown
  get(key: string): Promise<() => any>
}

type Loaded = { container: Container; keys: string[] | null }

// Um container por URL de remoteEntry: `init` roda uma vez só, mesmo com dois nomes apontando para ele.
const containers = new Map<string, Promise<Loaded>>()

const fail = (msg: string) => new Error(`[vitral] ${msg}`)

/** `Carrinho` e `./Carrinho` viram `./Carrinho`. */
const key = (k: string) => './' + k.replace(/^\.?\/?/, '')

/**
 * Entrada de `configure({ remotes })` para um remote do Module Federation.
 * `url` é o `mf-manifest.json` (ou, sem manifesto, o `remoteEntry.js`).
 */
export function federationRemote(url: string, options: FederationOptions = {}): RemoteEntry {
  return { module: () => namespace(url, options) }
}

async function namespace(url: string, options: FederationOptions) {
  const { container, keys } = await loadContainer(new URL(url, document.baseURI).href, options)
  const parts = new Map<string, Promise<any>>()
  const part = (k: string) => {
    let p = parts.get(k)
    if (!p) {
      p = Promise.resolve(container.get(k)).then((factory) => adapted(factory(), k, options))
      // Falha não fica no cache: o `retry` do host tenta de novo.
      p.catch(() => parts.delete(k))
      parts.set(k, p)
    }
    return p
  }
  // `carrinho/Carrinho` procura a chave `./Carrinho` neste mapa.
  const exposes: Record<string, () => Promise<any>> = keys
    ? Object.fromEntries(keys.map((k) => [k, () => part(k)]))
    : new Proxy({}, { get: (_, k) => (typeof k == 'string' && k.startsWith('./') ? () => part(k) : undefined) })
  const main = options.expose ? key(options.expose) : keys?.length === 1 ? keys[0] : undefined
  const remote: RemoteModule<any> = {
    async mount(el, props, ctx) {
      if (!main) throw fail(`${ctx.name}: o manifesto expõe ${keys?.join(', ') || 'várias partes'}. Use ${ctx.name}/<parte> ou a opção expose.`)
      const ns = await part(main)
      const target = typeof ns?.mount == 'function' ? ns : ns?.default
      if (typeof target?.mount != 'function') throw fail(`${ctx.name}: ${main} não exporta mount(). Use a opção adapt de federationRemote.`)
      return target.mount(el, props, ctx)
    },
  }
  return { default: remote, exposes }
}

/** O módulo exposto, com `default` trocado pelo resultado de `adapt` quando ele não tem `mount`. */
function adapted(ns: any, k: string, options: FederationOptions): any {
  if (typeof ns?.mount == 'function' || typeof ns?.default?.mount == 'function' || !options.adapt) return ns
  const remote = options.adapt(ns, k)
  return typeof remote?.mount == 'function' ? { ...ns, default: remote } : ns
}

/** Baixa o manifesto e o `remoteEntry.js` e chama `init` (uma vez por container). */
function loadContainer(url: string, options: FederationOptions = {}): Promise<Loaded> {
  let job = containers.get(url)
  if (!job) {
    job = start(url, options)
    job.catch(() => containers.delete(url))
    containers.set(url, job)
  }
  return job
}

async function start(url: string, options: FederationOptions): Promise<Loaded> {
  let entry = url
  let global = options.global
  let keys: string[] | null = null
  if (new URL(url).pathname.endsWith('.json')) {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw fail(`HTTP ${res.status} ao baixar ${url}`)
    const m = (await res.json()) as FederationManifest
    const re = m.metaData?.remoteEntry
    if (!re?.name) throw fail(`${url} não é um mf-manifest.json (falta metaData.remoteEntry)`)
    const pub = m.metaData!.publicPath
    // `getPublicPath` é código JS em texto: executar exigiria eval.
    if ((!pub || pub === 'auto') && m.metaData!.getPublicPath) throw fail(`${url}: getPublicPath não é suportado. Use publicPath.`)
    const base = pub && pub !== 'auto' ? new URL(pub, url).href : url
    entry = new URL((re.path ? re.path.replace(/\/?$/, '/') : '') + re.name, base).href
    global = re.type === 'module' || re.type === 'esm' ? undefined : (m.metaData!.globalName ?? m.name)
    if (re.type !== 'module' && re.type !== 'esm' && !global) throw fail(`${url}: falta metaData.globalName`)
    keys = (m.exposes ?? []).map((e) => key(e.path))
  }
  const origin = new URL(entry).origin
  const allowed = [new URL(url).origin, ...(options.allowedOrigins ?? [])]
  if (!allowed.includes('*') && !allowed.includes(origin)) throw fail(`remoteEntry em ${origin} não está em allowedOrigins`)
  const container: Container = global ? await script(entry, global) : await import(/* @vite-ignore */ /* webpackIgnore: true */ entry)
  if (typeof container?.get != 'function' || typeof container.init != 'function') throw fail(`${entry} não é um container do Module Federation (sem get/init)`)
  await container.init(shareScope(options.shared))
  return { container, keys }
}

/**
 * Share scope no formato do webpack (`{ react: { '19.1.0': { get, loaded, from } } }`)
 * a partir das dependências do host. É o que `federationRemote` passa para `init`.
 */
export function shareScope(shared: FederationOptions['shared'] = {}): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const { version, modules } of Object.values(shared)) {
    for (const [spec, mod] of Object.entries(modules)) (out[spec] ??= {})[version] = { get: () => Promise.resolve(() => mod), loaded: 1, from: 'vitral' }
  }
  return out
}

/** Carrega um `remoteEntry.js` em formato global e devolve a variável que ele cria. */
function script(src: string, global: string): Promise<Container> {
  const w = window as unknown as Record<string, Container | undefined>
  // O host do Module Federation pode já ter carregado este container.
  if (w[global]) return Promise.resolve(w[global]!)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => (w[global] ? resolve(w[global]!) : reject(fail(`${src} não criou window.${global}`)))
    s.onerror = () => {
      s.remove()
      reject(fail(`falha ao carregar ${src}`))
    }
    document.head.appendChild(s)
  })
}
