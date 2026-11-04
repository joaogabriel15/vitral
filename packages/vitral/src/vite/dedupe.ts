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
import { execFileSync } from 'node:child_process'
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

/**
 * Nomes que o remote lê de cada especificador do host, a partir dos módulos
 * que o build manteve (`renderedExports`). Vai no manifesto (`uses`): o host
 * oferece só esses nomes e o boot confere que a oferta tem todos.
 */
export function usedNames(modules: Iterable<[string, { renderedExports?: string[] }]>): Record<string, string[]> {
  const out: Record<string, Set<string>> = {}
  const add = (spec: string, name: string) => (out[spec] ??= new Set()).add(name)
  for (const [id, m] of modules) {
    if (id.startsWith(SHIM)) {
      const spec = id.slice(SHIM.length)
      out[spec] ??= new Set()
      for (const n of m.renderedExports ?? []) add(spec, n)
    } else if (id.startsWith(DEEP)) for (const n of m.renderedExports ?? []) for (const [spec, name] of deepVia.get(id)?.get(n) ?? []) add(spec, name)
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]))
}

/** Arquivo interno (`\0vitral-deep:`): nome exportado → [especificador, nome] no host. */
const deepVia = new Map<string, Map<string, [string, string][]>>()

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
  const files: [Group, string, string][] = []
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
      files.push([group, spec, found.id.split('?')[0]])
      group.keys.push(spec)
    }
    // Svelte e Angular dependem de internos do runtime: só a versão exata.
    group.range = name === 'svelte' || name.startsWith('@angular/') ? group.version : `^${group.version}`
    out.push(group)
  }
  const names = exportNames(files.map(([, , f]) => f))
  files.forEach(([g, spec], i) => names[i] && (g.names[spec] = names[i]!))
  return out
}

const MARK = '@@vitral-names@@'

/** O Node carrega o arquivo como CommonJS? (extensão e `type` do package.json mais próximo) */
function isCommonJs(file: string): boolean {
  if (/\.cjs$/.test(file)) return true
  if (!/\.js$/.test(file)) return false
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const json = join(dir, 'package.json')
    if (existsSync(json)) {
      try {
        return JSON.parse(readFileSync(json, 'utf8')).type !== 'module'
      } catch {
        return false
      }
    }
  }
  return true
}

/**
 * Nomes exportados de cada arquivo, como o build de produção os vê. Num
 * processo à parte com `NODE_ENV=production`: o React de dev exporta nomes
 * que o de produção não tem (`act`, `captureOwnerStack`), e o processo do
 * build pode já ter carregado a versão de dev. Em CommonJS, só os nomes que
 * existem no `module.exports`: a análise estática do Node junta os dois ramos
 * do `if (NODE_ENV === 'production')`. `null`: o Node não importa o arquivo
 * (código-fonte TypeScript, aliases), e os nomes saem do build.
 */
export function exportNames(files: string[]): (string[] | null)[] {
  if (!files.length) return []
  const code = `const out = []
for (const [f, cjs] of JSON.parse(process.argv[1])) {
  try {
    const mod = await import(f)
    // CommonJS: os nomes ficam no module.exports, que pode ser uma função (o axios é).
    const obj = mod.default && (typeof mod.default === "object" || typeof mod.default === "function") ? mod.default : undefined
    const all = cjs ? Object.keys(obj ?? {}) : [...new Set([...Object.keys(mod), ...Object.keys(obj ?? {})])]
    out.push(all.filter((n) => n !== "default" && ${ident}.test(n)))
  } catch {
    out.push(null)
  }
}
process.stdout.write("\\n${MARK}" + JSON.stringify(out))`
  const env = { ...process.env, NODE_ENV: process.env.NODE_ENV === 'development' ? 'development' : 'production' }
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(files.map((f) => [pathToFileURL(f).href, isCommonJs(f)]))], { env, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(out.slice(out.lastIndexOf(MARK) + MARK.length))
  } catch {
    return files.map(() => null)
  }
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
        // Um nome que só existe no `default` (como `axios.get`) também sai por nome: o `require()`
        // de um pacote CommonJS recebe o módulo inteiro e lê esses nomes dele.
        return (
          `import { deps } from ${JSON.stringify(DEPS)}\n` +
          `const m = deps[${JSON.stringify(spec)}]\n` +
          `const d = m.default ?? m\n` +
          `export default d\n` +
          // `export { v as "delete" }`: nomes que são palavras reservadas (`axios.delete`) também saem.
          names.map((n, i) => `const v${i} = ${JSON.stringify(n)} in m ? m[${JSON.stringify(n)}] : d?.[${JSON.stringify(n)}]\nexport { v${i} as ${JSON.stringify(n)} }\n`).join('')
        )
      }
      if (id.startsWith(DEEP)) {
        const file = id.slice(DEEP.length)
        const g = getGroups().find((x) => x.files && inside(x, file))!
        const index = await originsOf(ctx, g)
        const own = await exportOrigins(ctx, file, exports)
        const via = [...own].map(([name, origin]) => [name, index.get(origin)] as const)
        const f = JSON.stringify(file)
        const shared = via.filter(([, v]) => v)
        const rest = via.filter(([, v]) => !v).map(([name]) => name)
        deepVia.set(id, new Map(shared.map(([name, v]) => [name, [[v!.spec, v!.name]]])))
        if (!shared.length) {
          ctx.warn?.(`dedupe: ${file.slice(g.dir!.length + 1)} não sai por nenhum export de ${g.name}: o remote leva uma cópia própria deste arquivo`)
          return `export * from ${f}\n` + (own.has('default') ? `export { default } from ${f}\n` : '')
        }
        // Os nomes que saem por um especificador do pacote vêm do objeto do host; só os outros, da cópia própria.
        if (rest.length)
          ctx.warn?.(`dedupe: ${file.slice(g.dir!.length + 1)}: ${rest.join(', ')} não sai(em) por nenhum export de ${g.name}: esses nomes vêm de uma cópia própria deste arquivo`)
        return (
          `import { deps } from ${JSON.stringify(DEPS)}\n` +
          shared.map(([name, v], i) => `const v${i} = deps[${JSON.stringify(v!.spec)}][${JSON.stringify(v!.name)}]\n` + (name === 'default' ? `export default v${i}\n` : `export { v${i} as ${JSON.stringify(name)} }\n`)).join('') +
          (rest.length ? `export { ${rest.map((n) => (n === 'default' ? 'default' : JSON.stringify(n))).join(', ')} } from ${f}\n` : '')
        )
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
const uses = (p && p.uses && p.uses[import.meta.url]) || {}
async function need(name, range, version, keys, load) {
  let m = shared && (await p.dedupe(name, range, { version, load }))
  // A oferta pode ter só os nomes que o remote usa (host Next): confere cada um.
  const has = (o, n) => n === "default" || (o != null && (n in o || (o.default != null && n in Object(o.default))))
  const lacks = m ? keys.filter((k) => !(k in m)) : []
  const names = m ? keys.flatMap((k) => (k in m ? (uses[name]?.[k] || []).filter((n) => !has(m[k], n)).map((n) => k + " " + n) : [])) : []
  // React e React DOM nunca têm duas cópias na página (hooks e contexto
  // quebram): um nome que falta só gera aviso, e o remote fica com a oferta.
  const keep = name === "react" && !lacks.length
  if (lacks.length || names.length)
    console.warn("[vitral] dedupe: a oferta de " + name + " não tem " + [...lacks, ...names].join(", ") + (keep ? "; o remote usa a oferta do host mesmo assim" : "; o remote usa a cópia própria inteira"))
  if (!m || ((lacks.length || names.length) && !keep)) m = await load()
  Object.assign(deps, m)
}
await Promise.all([${calls.join(', ')}])
const remote = await import(${JSON.stringify(entry)})
export default remote.default
`
}
