/**
 * Host Next.js (Pages Router) com remotes do vitral no lugar das zonas do
 * Multi-Zones.
 *
 *   // next.config.js
 *   const { withVitral } = require('vitral/next-config')
 *   module.exports = withVitral(nextConfig, {
 *     remotes: {
 *       delivery: {
 *         url: '/delivery-remote/vitral.json',
 *         basePath: '/delivery',
 *         routes: [{ public: '/store', zone: '/delivery/store' }],
 *       },
 *     },
 *     share: ['i18next', 'react-i18next', '@empresa/ui/*'],
 *   })
 *
 * Gera os `rewrites` das rotas públicas para a página do remote, os headers
 * de cache dos arquivos do remote e o módulo que `vitral/next-host` lê
 * (remotes e as dependências que o host oferece com `dedupe`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ZoneRoute } from './next'
import { subpaths } from './vite/dedupe'

export type { ZoneRoute }

export interface NextRemoteConfig {
  /** URL do `vitral.json`. Num caminho do próprio host (`/x/vitral.json`), ganha os headers de cache. */
  url: string
  /**
   * Página do host que renderiza o `NextRemote` (`pages/<basePath>/[[...slug]]`),
   * e o `basePath` que o remote vê, como no `next.config` da zona.
   */
  basePath: string
  /** Rotas públicas que abrem o remote, como os `rewrites` do Multi-Zones. */
  routes?: ZoneRoute[]
  /**
   * Quando baixar o remote antes de alguém abrir: `'idle'` com o navegador
   * ocioso, `'route'` só ao abrir uma rota dele. Padrão: `'idle'`.
   */
  preload?: 'idle' | 'route' | false
  /**
   * Depois do preload, aquece também os chunks das rotas do remote
   * (`import()`), com o navegador ocioso: a primeira tela de cada rota abre
   * sem download. Padrão: false.
   */
  warmRoutes?: boolean
  /**
   * `false` dispensa a conferência de hash (SRI) do `vitral.json`. Só para
   * remote servido pela mesma origem do host.
   */
  integrity?: false
  /**
   * Em `next dev`, o dev server do remote (`http://localhost:5173`): o
   * remote vem dele, com HMR, sem `?vitral=`. A CSP de dev do host precisa
   * liberar essa origem em `script-src` e em `connect-src` (`ws:` do HMR).
   */
  devUrl?: string
}

export interface WithVitralOptions {
  remotes: Record<string, NextRemoteConfig>
  /**
   * Dependências que o host oferece aos remotes com `dedupe`, só baixadas
   * quando um remote pede. `pacote/*` oferece o pacote e cada subpath do
   * `exports`. O React o `NextRemote` já oferece.
   */
  share?: string[]
  /** Pasta do app. Padrão: `process.cwd()`. */
  dir?: string
}

/** Id do módulo gerado; o `vitral/next-host` importa dele. */
export const HOST_CONFIG = 'vitral-next-host-config'

type Rewrite = { source: string; destination: string }
type Rewrites = Rewrite[] | { beforeFiles?: Rewrite[]; afterFiles?: Rewrite[]; fallback?: Rewrite[] }
type Header = { source: string; headers: { key: string; value: string }[] }
type NextConfig = Record<string, any> & {
  distDir?: string
  rewrites?: () => Promise<Rewrites> | Rewrites
  headers?: () => Promise<Header[]> | Header[]
  webpack?: (config: any, context: any) => any
  turbopack?: { resolveAlias?: Record<string, string> }
}

const pkgOf = (spec: string) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')
const REACT = /^(react|react-dom|scheduler)(\/|$)/

/** package.json do pacote `pkg` instalado no app. */
function installed(dir: string, pkg: string): any {
  const req = createRequire(join(dir, 'package.json'))
  let file: string
  try {
    file = req.resolve(`${pkg}/package.json`)
  } catch {
    file = req.resolve(pkg)
  }
  for (let d = dirname(file); d !== dirname(d); d = dirname(d)) {
    const json = join(d, 'package.json')
    if (!existsSync(json)) continue
    const data = JSON.parse(readFileSync(json, 'utf8'))
    if (data.name === pkg) return data
  }
  throw new Error(`[vitral] ${pkg} não está instalado no app`)
}

/** Grupos de `dedupe` do host: versão instalada e especificadores. */
export function sharedGroups(dir: string, share: string[]): Record<string, { version: string; specs: string[] }> {
  const out: Record<string, { version: string; specs: string[] }> = {}
  for (const spec of share) {
    const name = pkgOf(spec)
    if (REACT.test(name)) continue
    const data = installed(dir, name)
    const g = (out[name] ??= { version: data.version, specs: [] })
    for (const s of spec.endsWith('/*') ? subpaths(name, data) : [spec]) if (!g.specs.includes(s)) g.specs.push(s)
  }
  return out
}

/**
 * O especificador como o webpack do app vai achar. Um alias do pacote para a
 * pasta dele (`'@empresa/ui': '/app/node_modules/@empresa/ui'`) faz o webpack
 * procurar `pasta/subpath` sem olhar o `exports`: aí o subpath vira o arquivo
 * que o `exports` aponta.
 */
export function throughAlias(spec: string, alias: Record<string, unknown> = {}): string {
  for (const [key, value] of Object.entries(alias)) {
    if (typeof value !== 'string' || key.endsWith('$') || !spec.startsWith(key + '/')) continue
    const json = join(value, 'package.json')
    if (!existsSync(json)) continue
    const exp = JSON.parse(readFileSync(json, 'utf8')).exports
    const target = exp?.['.' + spec.slice(key.length)]
    const file = typeof target === 'string' ? target : (target?.import ?? target?.default)
    if (typeof file === 'string') return resolve(value, file)
  }
  return spec
}

/** Código do módulo gerado: configuração dos remotes e ofertas que só importam quando pedidas. */
export function hostModule(remotes: Record<string, NextRemoteConfig>, groups: ReturnType<typeof sharedGroups>, alias?: Record<string, unknown>, from?: string): string {
  // Caminho relativo ao módulo gerado: o Turbopack não aceita caminho absoluto em import().
  const spec = (s: string) => {
    const t = throughAlias(s, alias)
    if (!from || !isAbsolute(t)) return t
    const r = relative(from, t).replace(/\\/g, '/')
    return r.startsWith('.') ? r : './' + r
  }
  const shared = Object.entries(groups).map(([name, g]) => {
    const imports = g.specs.map((s) => `import(${JSON.stringify(spec(s))})`).join(', ')
    const modules = g.specs.map((s, i) => `${JSON.stringify(s)}: m[${i}]`).join(', ')
    return `  ${JSON.stringify(name)}: { version: ${JSON.stringify(g.version)}, modules: () => Promise.all([${imports}]).then((m) => ({ ${modules} })) },`
  })
  return `export const remotes = ${JSON.stringify(remotes, null, 2)}\nexport const shared = {\n${shared.join('\n')}\n}\n`
}

/** Pasta do `vitral.json` de um remote servido pelo próprio host, ou nada. */
const localDir = (url: string) => (url.startsWith('/') && !url.startsWith('//') ? url.slice(0, url.lastIndexOf('/') + 1) : undefined)

/** Em dev, `devUrl` no lugar de `url` (o manifesto do dev server, em `/vitral.json`). */
export function devRemotes(remotes: Record<string, NextRemoteConfig>, dev: boolean): Record<string, NextRemoteConfig> {
  if (!dev) return remotes
  return Object.fromEntries(
    Object.entries(remotes).map(([name, r]) => [name, r.devUrl ? { ...r, url: /\.json(\?|$)/.test(r.devUrl) ? r.devUrl : r.devUrl.replace(/\/?$/, '/vitral.json') } : r]),
  )
}

export function remoteRewrites(remotes: Record<string, NextRemoteConfig>): Rewrite[] {
  return Object.values(remotes).flatMap((r) =>
    (r.routes ?? []).filter((x) => x.public !== x.zone).map((x) => ({ source: `${x.public}/:path*`, destination: `${x.zone}/:path*` })),
  )
}

export function remoteHeaders(remotes: Record<string, NextRemoteConfig>): Header[] {
  const immutable = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
  return Object.values(remotes).flatMap((r) => {
    const dir = localDir(r.url)
    if (!dir) return []
    return [
      // O manifesto muda a cada deploy; os arquivos têm hash no nome.
      { source: r.url, headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: `${dir}:file(remote-.*)`, headers: immutable },
      { source: `${dir}split/:file*`, headers: immutable },
    ]
  })
}

/** Grava só se o conteúdo mudou: o \`mtime\` igual não dispara rebuild no \`next dev\`. */
function writeChanged(file: string, text: string): void {
  try {
    if (readFileSync(file, 'utf8') === text) return
  } catch {}
  writeFileSync(file, text)
}

export function withVitral(nextConfig: NextConfig, options: WithVitralOptions): NextConfig {
  const dir = resolve(options.dir ?? process.cwd())
  // Fora do distDir, que o Turbopack não lê. A pasta se ignora sozinha no git.
  const file = join(dir, '.vitral', 'host-config.mjs')
  const groups = sharedGroups(dir, options.share ?? [])
  const emit = (alias?: Record<string, unknown>) => {
    try {
      mkdirSync(dirname(file), { recursive: true })
      writeChanged(join(dirname(file), '.gitignore'), '*\n')
      writeChanged(file, hostModule(devRemotes(options.remotes, process.env.NODE_ENV === 'development'), groups, alias, dirname(file)))
    } catch (e) {
      // `next start` num disco só de leitura: o build já levou o módulo gerado.
      console.warn(`[vitral] não consegui gravar ${file} (${(e as Error).message}). No build ele é necessário; no next start, não.`)
    }
  }
  // Turbopack não chama o `webpack()`: vale o alias dele (caminhos relativos ao app).
  emit(Object.fromEntries(Object.entries(nextConfig.turbopack?.resolveAlias ?? {}).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('.') ? resolve(dir, v) : v])))
  const ours = remoteRewrites(options.remotes)
  const headers = remoteHeaders(options.remotes)
  return {
    ...nextConfig,
    // O webpack do app empacota o vitral também no servidor: senão o Node não acha o módulo gerado.
    transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), 'vitral'])],
    async rewrites() {
      const user: Rewrites = (await nextConfig.rewrites?.()) ?? []
      // Antes das páginas: a rota pública abre a página do remote.
      return Array.isArray(user)
        ? { beforeFiles: ours, afterFiles: user, fallback: [] }
        : { ...user, beforeFiles: [...ours, ...(user.beforeFiles ?? [])] }
    },
    async headers() {
      return [...headers, ...((await nextConfig.headers?.()) ?? [])]
    },
    webpack(config: any, context: any) {
      const out = nextConfig.webpack ? nextConfig.webpack(config, context) : config
      // Com os aliases finais do app.
      if (out.resolve.alias && !Array.isArray(out.resolve.alias)) emit(out.resolve.alias)
      out.resolve.alias = { ...out.resolve.alias, [`${HOST_CONFIG}$`]: file }
      return out
    },
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: { ...nextConfig.turbopack?.resolveAlias, [HOST_CONFIG]: './' + relative(dir, file).replace(/\\/g, '/') },
    },
  }
}
