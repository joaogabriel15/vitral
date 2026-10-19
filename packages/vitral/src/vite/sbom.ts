/**
 * SBOM do remote (opção `sbom`): CycloneDX 1.6 em JSON, com os pacotes que
 * de fato entraram no bundle. A lista sai dos módulos do Rollup/Rolldown, não
 * do package.json: dependência instalada que o tree-shaking tirou não entra,
 * dependência transitiva que entrou aparece.
 *
 * O remote é o componente principal (`metadata.component`). Cada pacote leva
 * nome, versão, licença e purl `pkg:npm/...`; `dependencies` liga cada um aos
 * pacotes do bundle que ele importa, resolvidos como o Node resolve.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, sep } from 'node:path'

export const SBOM_FILE = 'sbom.cdx.json'

interface Pkg {
  name?: string
  version?: string
  license?: string | { type?: string }
  licenses?: { type?: string }[]
  description?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

type Bundle = Record<string, { type: string; modules?: Record<string, { renderedLength: number }> }>

const readPkg = (dir: string): Pkg | undefined => {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return undefined
  }
}

/** Arquivos dos módulos que deixaram código no bundle (sem virtuais e sem o que o tree-shaking tirou). */
export function bundledFiles(bundle: Bundle, into = new Set<string>()): Set<string> {
  for (const f of Object.values(bundle)) {
    if (f.type !== 'chunk' || !f.modules) continue
    for (const [id, m] of Object.entries(f.modules)) {
      const file = id.split('?')[0]
      if (m.renderedLength > 0 && isAbsolute(file)) into.add(file)
    }
  }
  return into
}

/**
 * Pasta do pacote de cada arquivo. Em `node_modules`, é a pasta logo depois
 * do último `node_modules/` (o pnpm guarda em `.pnpm/x@1/node_modules/x`);
 * package.json internos, como `preact/hooks`, não contam. Fora dele (pacote
 * do workspace), é o package.json com `name` mais próximo.
 */
export function packageDirs(files: Iterable<string>): Set<string> {
  const dirs = new Set<string>()
  const near = new Map<string, string | null>()
  const nearest = (dir: string): string | null => {
    if (near.has(dir)) return near.get(dir)!
    const parent = dirname(dir)
    const found = readPkg(dir)?.name ? dir : parent === dir ? null : nearest(parent)
    near.set(dir, found)
    return found
  }
  const nm = `${sep}node_modules${sep}`
  for (const file of files) {
    const at = file.lastIndexOf(nm)
    if (at >= 0) {
      const parts = file.slice(at + nm.length).split(sep)
      const name = parts[0].startsWith('@') ? parts.slice(0, 2).join(sep) : parts[0]
      if (parts.length > (parts[0].startsWith('@') ? 2 : 1)) dirs.add(file.slice(0, at + nm.length) + name)
    } else {
      const dir = nearest(dirname(file))
      if (dir) dirs.add(dir)
    }
  }
  return dirs
}

/** purl de um pacote npm: o `@` do escopo vira `%40`. */
export function purl(name: string, version?: string): string {
  const path = name.split('/').map(encodeURIComponent).join('/')
  return `pkg:npm/${path}${version ? `@${encodeURIComponent(version)}` : ''}`
}

/**
 * Licença no formato do CycloneDX. Identificador ou expressão SPDX
 * (`MIT`, `(MIT OR Apache-2.0)`) vai em `expression`; o resto
 * (`SEE LICENSE IN ...`, `UNLICENSED`) vai como nome.
 */
function licenses(pkg: Pkg): object[] | undefined {
  const raw = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? pkg.licenses?.map((l) => l.type).filter(Boolean).join(' OR ')
  if (!raw) return undefined
  const spdx = /^\(?[A-Za-z0-9.+-]+( (AND|OR|WITH) \(?[A-Za-z0-9.+-]+\)?)*\)?$/.test(raw) && raw !== 'UNLICENSED'
  return spdx ? [{ expression: raw }] : [{ license: { name: raw } }]
}

function component(pkg: Pkg & { name: string }, type: 'library' | 'application') {
  const scoped = pkg.name.startsWith('@') && pkg.name.includes('/')
  const ref = purl(pkg.name, pkg.version)
  const license = licenses(pkg)
  return {
    type,
    'bom-ref': ref,
    ...(scoped && { group: pkg.name.slice(0, pkg.name.indexOf('/')) }),
    name: scoped ? pkg.name.slice(pkg.name.indexOf('/') + 1) : pkg.name,
    ...(pkg.version && { version: pkg.version }),
    ...(pkg.description && { description: pkg.description }),
    ...(license && { licenses: license }),
    purl: ref,
  }
}

/** Pasta onde o Node acharia `name` a partir de `from`, já sem links simbólicos. */
function resolveDir(from: string, name: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) {
      try {
        return realpathSync(candidate)
      } catch {
        return candidate
      }
    }
    if (dirname(dir) === dir) return undefined
  }
}

export interface SbomInput {
  /** Pasta do projeto do remote (a do package.json dele). */
  root: string
  name: string
  version?: string
  /** Arquivos que entraram no bundle (`bundledFiles`). */
  files: Iterable<string>
  /** Bytes do JS principal do remote, para o hash do componente principal. */
  entry?: Buffer
  /** Versão do vitral, registrada em `metadata.tools`. */
  tool?: string
  /** Momento da geração. Padrão: `SOURCE_DATE_EPOCH` ou agora. */
  timestamp?: Date
}

/** O documento CycloneDX 1.6. */
export function createSbom(input: SbomInput): Record<string, unknown> {
  const rootDir = realpathSync(input.root)
  const rootPkg = readPkg(rootDir) ?? {}
  const main = component({ ...rootPkg, name: input.name, version: input.version }, 'application')
  const hashes = input.entry && [{ alg: 'SHA-512', content: createHash('sha512').update(input.entry).digest('hex') }]
  // Pacote por pasta; o próprio remote fica de fora (é o componente principal).
  const byDir = new Map<string, { pkg: Pkg & { name: string }; ref: string }>()
  for (const dir of packageDirs(input.files)) {
    let real = dir
    try {
      real = realpathSync(dir)
    } catch {}
    const pkg = readPkg(real)
    if (real === rootDir || !pkg?.name || byDir.has(real)) continue
    byDir.set(real, { pkg: pkg as Pkg & { name: string }, ref: purl(pkg.name, pkg.version) })
  }
  const deps = (dir: string, pkg: Pkg) => {
    const names = Object.keys({ ...pkg.peerDependencies, ...pkg.optionalDependencies, ...pkg.dependencies })
    const refs = new Set<string>()
    for (const n of names) {
      const hit = byDir.get(resolveDir(dir, n) ?? '')
      if (hit) refs.add(hit.ref)
    }
    return [...refs].sort()
  }
  // Mesmo nome e versão em duas pastas (cópias do pnpm): um componente só.
  const components = new Map<string, ReturnType<typeof component>>()
  const graph = new Map<string, Set<string>>([[main['bom-ref'], new Set(deps(rootDir, rootPkg))]])
  for (const [dir, { pkg, ref }] of byDir) {
    if (!components.has(ref)) components.set(ref, component(pkg, 'library'))
    const set = graph.get(ref) ?? new Set<string>()
    for (const d of deps(dir, pkg)) if (d !== ref) set.add(d)
    graph.set(ref, set)
  }
  const epoch = Number(process.env.SOURCE_DATE_EPOCH)
  const timestamp = input.timestamp ?? (Number.isFinite(epoch) && process.env.SOURCE_DATE_EPOCH ? new Date(epoch * 1000) : new Date())
  const body = {
    metadata: {
      timestamp: timestamp.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      tools: { components: [{ type: 'application', name: 'vitral', ...(input.tool && { version: input.tool }), purl: purl('vitral', input.tool) }] },
      component: { ...main, ...(hashes && { hashes }) },
    },
    components: [...components.values()].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'])),
    dependencies: [...graph].map(([ref, set]) => ({ ref, dependsOn: [...set].sort() })),
  }
  // Mesmo conteúdo, mesmo número de série: build reproduzível com SOURCE_DATE_EPOCH.
  const h = createHash('sha1').update(JSON.stringify(body)).digest('hex')
  const serial = `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: serial,
    version: 1,
    ...body,
  }
}
