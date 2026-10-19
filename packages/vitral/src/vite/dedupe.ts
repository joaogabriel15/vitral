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
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** O grupo do React vem inteiro do mesmo lugar: o React DOM exige a mesma versão do React. */
const REACT = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react/compiler-runtime']

export const BOOT = 'virtual:vitral-boot'
const DEPS = '\0vitral-deps'
const OWN = '\0vitral-own:'
const SHIM = '\0vitral-shim:'

export interface Group {
  name: string
  range: string
  version: string
  /** Especificadores do grupo que o remote recebe de fora. */
  keys: string[]
  /** Nomes exportados por especificador, para os módulos síncronos. */
  names: Record<string, string[]>
  /** Pacotes do grupo (os imports de dentro deles não viram shim). */
  pkgs: string[]
}

const pkgOf = (spec: string) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')
const groupOf = (spec: string) => (REACT.includes(spec) || pkgOf(spec) === 'scheduler' ? 'react' : pkgOf(spec))
const ident = /^[A-Za-z_$][\w$]*$/

/** Versão do pacote dono do arquivo `file`. */
function versionOf(file: string, pkg: string): string {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const json = join(dir, 'package.json')
    if (!existsSync(json)) continue
    const data = JSON.parse(readFileSync(json, 'utf8'))
    if (data.name === pkg) return data.version
  }
  throw new Error(`vitral: versão de ${pkg} não encontrada`)
}

type Resolve = (id: string, importer: string) => Promise<{ id: string } | null>

/** Lê as dependências instaladas e monta os grupos. */
export async function groups(list: string[], root: string, entry: string, resolveId: Resolve): Promise<Group[]> {
  const importer = resolve(root, entry)
  const byName = new Map<string, string[]>()
  for (const spec of list) {
    const g = groupOf(spec)
    byName.set(g, [...new Set([...(byName.get(g) ?? []), ...(g === 'react' ? REACT : [spec])])])
  }
  const out: Group[] = []
  for (const [name, specs] of byName) {
    const group: Group = { name, range: '', version: '', keys: [], names: {}, pkgs: name === 'react' ? ['react', 'react-dom', 'scheduler'] : [name] }
    for (const spec of specs) {
      const found = await resolveId(spec, importer)
      if (!found) {
        if (spec === name) throw new Error(`vitral: dedupe: ${spec} não está instalado`)
        continue
      }
      const mod = await import(pathToFileURL(found.id.split('?')[0]).href)
      const extra = mod.default && typeof mod.default === 'object' ? Object.keys(mod.default) : []
      group.names[spec] = [...new Set([...Object.keys(mod), ...extra])].filter((n) => n !== 'default' && ident.test(n))
      group.keys.push(spec)
      if (spec === name) group.version = versionOf(found.id, name)
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
  const specs = new Set(list.flatMap((s) => (groupOf(s) === 'react' ? REACT : [s])))
  return new RegExp(`${escape(BOOT)}$|^(${[DEPS, ...specs].map(escape).join('|')})$|^(${escape(OWN)}|${escape(SHIM)})`)
}

/** Hooks de resolução e carregamento. `getGroups` só tem valor depois do buildStart. */
export function dedupeHooks(entry: () => string, getGroups: () => Group[]) {
  const keyOf = (id: string) => getGroups().find((g) => g.keys.includes(id))
  return {
    resolveId: {
      order: 'pre' as const,
      handler(id: string, importer?: string) {
        if (id.endsWith(BOOT)) return `\0${BOOT}`
        if (id === DEPS || id.startsWith(OWN) || id.startsWith(SHIM)) return id
        const g = keyOf(id)
        if (!g || !importer || importer.startsWith(OWN)) return null
        // Import de dentro do próprio grupo (react-dom → react) fica na cópia própria.
        const norm = importer.replace(/\\/g, '/')
        if (g.pkgs.some((p) => norm.includes(`/node_modules/${p}/`))) return null
        return SHIM + id
      },
    },
    load(id: string) {
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
        const names = keyOf(spec)!.names[spec]
        return (
          `import { deps } from ${JSON.stringify(DEPS)}\n` +
          `const m = deps[${JSON.stringify(spec)}]\n` +
          `export default m.default ?? m\n` +
          (names.length ? `export const { ${names.join(', ')} } = m\n` : '')
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
