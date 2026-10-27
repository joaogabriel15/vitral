/**
 * `dedupe` no plugin: o remote usa o framework que já está na página, se a
 * versão servir, ou a própria cópia.
 *
 * A entrada vira uma inicialização pequena que primeiro resolve cada grupo
 * (pede ao protocolo uma versão na faixa ou importa a cópia própria, que é um
 * chunk separado) e só depois importa o remote. Os imports do grupo no código
 * do remote viram módulos síncronos que leem o que já foi resolvido; por isso
 * `require('react')` de pacotes CommonJS continua funcionando.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { exportOrigins, type ParseContext, type Parsed } from './exports'

/** O grupo do React vem inteiro do mesmo lugar: o React DOM exige a mesma versão do React. */
const REACT = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react/compiler-runtime']

export const BOOT = 'virtual:vitral-boot'
const DEPS = '\0vitral-deps'
const OWN = '\0vitral-own:'
const SHIM = '\0vitral-shim:'
const DEEP = '\0vitral-deep:'

export interface Group {
  name: string
  range: string
  version: string
  /** Especificadores do grupo que o remote recebe de fora. */
  keys: string[]
  /**
   * Nomes exportados por especificador, para os módulos síncronos. Falta
   * quando o Node não importa o pacote (código-fonte TypeScript): aí os nomes
   * vêm do build.
   */
  names: Record<string, string[]>
  /** Pacotes do grupo (os imports de dentro deles não viram shim). */
  pkgs: string[]
  /** Pasta do pacote, sem links simbólicos. */
  dir?: string
  /** Com `pacote/*`: os imports que chegam a um arquivo do pacote também viram shim. */
  files?: boolean
}

const pkgOf = (spec: string) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')
const norm = (p: string) => p.replace(/\\/g, '/')
const groupOf = (spec: string) => (REACT.includes(spec) || pkgOf(spec) === 'scheduler' ? 'react' : pkgOf(spec))
const ident = /^[A-Za-z_$][\w$]*$/

/** package.json do pacote dono do arquivo `file`. */
function packageOf(file: string, pkg: string): { dir: string; data: any } {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const json = join(dir, 'package.json')
    if (!existsSync(json)) continue
    const data = JSON.parse(readFileSync(json, 'utf8'))
    if (data.name === pkg) return { dir, data }
  }
  throw new Error(`vitral: versão de ${pkg} não encontrada`)
}

/** `pacote/*`: o pacote e cada subpath JS do `exports` dele (sem curingas). */
export function subpaths(pkg: string, data: any): string[] {
  const exp = data.exports
  if (!exp || typeof exp !== 'object' || Array.isArray(exp) || !Object.keys(exp).some((k) => k.startsWith('.'))) return [pkg]
  const target = (v: any): string => (typeof v === 'string' ? v : v && typeof v === 'object' ? target(v.import ?? v.default ?? v.require ?? Object.values(v)[0]) : '')
  return Object.keys(exp)
    .filter((k) => !k.includes('*') && !/\.(json|css|scss)$/.test(target(exp[k])))
    .map((k) => (k === '.' ? pkg : pkg + k.slice(1)))
}

type Resolve = (id: string, importer: string) => Promise<{ id: string } | null>

/** Lê as dependências instaladas e monta os grupos. */
export async function groups(list: string[], root: string, entry: string, resolveId: Resolve): Promise<Group[]> {
  const importer = resolve(root, entry)
  const byName = new Map<string, string[]>()
  const all = new Set<string>()
  for (const spec of list) {
    const g = groupOf(spec)
    if (spec.endsWith('/*')) all.add(g)
    byName.set(g, [...new Set([...(byName.get(g) ?? []), ...(g === 'react' ? REACT : [spec.endsWith('/*') ? g : spec])])])
  }
  const out: Group[] = []
  for (const [name, list] of byName) {
    const group: Group = { name, range: '', version: '', keys: [], names: {}, pkgs: name === 'react' ? ['react', 'react-dom', 'scheduler'] : [name] }
    let specs = list
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]
      const found = await resolveId(spec, importer)
      if (!found) {
        if (spec === name) throw new Error(`vitral: dedupe: ${spec} não está instalado`)
        continue
      }
      if (spec === name) {
        const pkg = packageOf(found.id, name)
        group.version = pkg.data.version
        group.dir = norm(realpathSync(pkg.dir))
        if (all.has(name)) {
          group.files = true
          specs = [...new Set([...specs, ...subpaths(name, pkg.data)])]
        }
      }
      try {
        const mod = await import(pathToFileURL(found.id.split('?')[0]).href)
        const extra = mod.default && typeof mod.default === 'object' ? Object.keys(mod.default) : []
        group.names[spec] = [...new Set([...Object.keys(mod), ...extra])].filter((n) => n !== 'default' && ident.test(n))
      } catch {
        // Código-fonte (TypeScript, aliases): os nomes saem do build.
      }
      group.keys.push(spec)
    }
    // Svelte e Angular dependem de internos do runtime: só a versão exata.
    group.range = name === 'svelte' || name.startsWith('@angular/') ? group.version : `^${group.version}`
    out.push(group)
  }
  return out
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\0/g, '\\x00')

/** Ids que o `resolveId` de `dedupeHooks` trata, para o filtro do hook (os grupos só saem no buildStart). */
export function dedupeIds(list: string[]): RegExp {
  const specs = new Set(list.flatMap((s) => (groupOf(s) === 'react' ? REACT : [s.replace(/\/\*$/, '')])))
  return new RegExp(`${escape(BOOT)}$|^(${[DEPS, ...specs].map(escape).join('|')})$|^(${escape(OWN)}|${escape(SHIM)}|${escape(DEEP)})`)
}

/** Hooks de resolução e carregamento. `getGroups` só tem valor depois do buildStart. */
export function dedupeHooks(entry: () => string, getGroups: () => Group[]) {
  const keyOf = (id: string) => getGroups().find((g) => g.keys.includes(id))
  const inside = (g: Group, file: string) => {
    const f = norm(file)
    return g.pkgs.some((p) => f.includes(`/node_modules/${p}/`)) || (!!g.dir && f.startsWith(g.dir + '/'))
  }
  // Arquivo de cada especificador (como o build resolve) e a origem de cada export dos grupos com `files`.
  let entries: Promise<Map<string, string>> | undefined
  let origins: Map<string, Promise<Map<string, { spec: string; name: string }>>> = new Map()
  const exports = new Map<string, Promise<Parsed>>()
  const entryFiles = (ctx: ParseContext) =>
    (entries ??= (async () => {
      const map = new Map<string, string>()
      for (const g of getGroups())
        if (g.files)
          for (const k of g.keys) {
            const r = await ctx.resolve(k, undefined, { skipSelf: true })
            if (r && !r.external) map.set(r.id, k)
          }
      return map
    })())
  const originsOf = (ctx: ParseContext, g: Group) => {
    if (!origins.has(g.name))
      origins.set(g.name, (async () => {
        const files = await entryFiles(ctx)
        const index = new Map<string, { spec: string; name: string }>()
        for (const [file, spec] of files) {
          if (!g.keys.includes(spec)) continue
          for (const [name, origin] of await exportOrigins(ctx, file, exports)) if (!index.has(origin)) index.set(origin, { spec, name })
        }
        return index
      })())
    return origins.get(g.name)!
  }
  return {
    /** Nova build: esquece o que foi lido da anterior. */
    reset() {
      entries = undefined
      origins = new Map()
      exports.clear()
    },
    /** Algum grupo troca também os imports que chegam a arquivos do pacote? */
    files: () => getGroups().some((g) => g.files),
    resolveId: {
      order: 'pre' as const,
      handler(id: string, importer?: string) {
        if (id.endsWith(BOOT)) return `\0${BOOT}`
        if (id === DEPS || id.startsWith(OWN) || id.startsWith(SHIM) || id.startsWith(DEEP)) return id
        const g = keyOf(id)
        if (!g || !importer || importer.startsWith(OWN)) return null
        // Import de dentro do próprio grupo (react-dom → react) fica na cópia própria.
        if (inside(g, importer)) return null
        return SHIM + id
      },
    },
    /**
     * Um import já resolvido que chega a um arquivo de um grupo com `files`
     * (por alias, `paths` do tsconfig ou caminho direto): vira o shim do
     * especificador daquele arquivo, ou de um arquivo interno que o pacote reexporta.
     */
    async resolved(ctx: ParseContext, file: string, importer?: string): Promise<string | null> {
      if (!importer || importer.startsWith('\0')) return null
      const g = getGroups().find((x) => x.files && inside(x, file))
      if (!g || inside(g, importer)) return null
      const spec = (await entryFiles(ctx)).get(file)
      return spec ? SHIM + spec : DEEP + file
    },
    async load(ctx: ParseContext, id: string): Promise<string | null> {
      if (id === `\0${BOOT}`) return boot(entry(), getGroups())
      if (id === DEPS) return 'export const deps = {}'
      if (id.startsWith(OWN)) {
        const g = getGroups().find((x) => x.name === id.slice(OWN.length))!
        return (
          g.keys.map((k, i) => `import * as m${i} from ${JSON.stringify(k)}`).join('\n') +
          `\nexport default {${g.keys.map((k, i) => `${JSON.stringify(k)}: m${i}`).join(', ')}}\n`
        )
      }
      if (id.startsWith(SHIM)) {
        const spec = id.slice(SHIM.length)
        const g = keyOf(spec)!
        let names = g.names[spec]
        if (!names) {
          const file = [...(await entryFiles(ctx))].find(([, k]) => k === spec)?.[0]
          names = file ? [...(await exportOrigins(ctx, file, exports)).keys()].filter((n) => n !== 'default' && ident.test(n)) : []
        }
        return (
          `import { deps } from ${JSON.stringify(DEPS)}\n` +
          `const m = deps[${JSON.stringify(spec)}]\n` +
          `export default m.default ?? m\n` +
          (names.length ? `export const { ${names.join(', ')} } = m\n` : '')
        )
      }
      if (id.startsWith(DEEP)) {
        const file = id.slice(DEEP.length)
        const g = getGroups().find((x) => x.files && inside(x, file))!
        const index = await originsOf(ctx, g)
        const own = await exportOrigins(ctx, file, exports)
        const via = [...own].map(([name, origin]) => [name, index.get(origin)] as const)
        if (via.every(([, v]) => v) && via.length) {
          // Tudo o que o arquivo exporta sai também por um especificador do pacote: o mesmo objeto do host.
          return (
            `import { deps } from ${JSON.stringify(DEPS)}\n` +
            via.map(([name, v], i) => `const v${i} = deps[${JSON.stringify(v!.spec)}][${JSON.stringify(v!.name)}]\n` + (name === 'default' ? `export default v${i}\n` : `export { v${i} as ${JSON.stringify(name)} }\n`)).join('')
          )
        }
        ctx.warn?.(`dedupe: ${file.slice(g.dir!.length + 1)} não sai por nenhum export de ${g.name}: o remote leva uma cópia própria deste arquivo`)
        const f = JSON.stringify(file)
        return `export * from ${f}\n` + (own.has('default') ? `export { default } from ${f}\n` : '')
      }
      return null
    },
  }
}

/**
 * A entrada nova. Só o build dividido usa a versão de fora; o arquivo único
 * (hosts antigos e caminho com `blob:`) fica sempre com a cópia própria.
 */
function boot(entry: string, groups: Group[]): string {
  const calls = groups.map(
    (g) =>
      `need(${JSON.stringify(g.name)}, ${JSON.stringify(g.range)}, ${JSON.stringify(g.version)}, ${JSON.stringify(g.keys)}, ` +
      `() => import(${JSON.stringify(OWN + g.name)}).then((m) => m.default))`,
  )
  return `const { deps } = await import(${JSON.stringify(DEPS)})
const p = globalThis[Symbol.for("vitral")]
const shared = !!(p && p.dedupe) && /\\/split\\/[^/]*$/.test(import.meta.url)
async function need(name, range, version, keys, load) {
  let m = shared && (await p.dedupe(name, range, { version, load }))
  if (!m || keys.some((k) => !(k in m))) m = await load()
  Object.assign(deps, m)
}
await Promise.all([${calls.join(', ')}])
const remote = await import(${JSON.stringify(entry)})
export default remote.default
`
}
