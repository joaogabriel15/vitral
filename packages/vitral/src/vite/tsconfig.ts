/**
 * `paths` do tsconfig, como o Next resolve: cada arquivo usa o tsconfig mais
 * próximo dele. Um pacote publicado como código-fonte (`transpilePackages`)
 * traz o próprio tsconfig, e os `@/` de dentro dele apontam para ele, não
 * para o app. Os alvos são tentados em ordem, como no TypeScript.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

export interface PathsConfig {
  /** Pasta do tsconfig. */
  dir?: string
  base: string
  paths: Record<string, string[]>
}

/** JSON com comentários e vírgulas sobrando, como o tsconfig aceita. */
export function parseJsonc(text: string): any {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      const end = /"(?:[^"\\]|\\.)*"/y
      end.lastIndex = i
      const m = end.exec(text)
      const s = m ? m[0] : text.slice(i)
      out += s
      i += s.length - 1
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2)
      if (i < 0) break
      i++
    } else out += c
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

function read(file: string, seen = new Set<string>()): { baseUrl?: string; paths?: Record<string, string[]>; pathsBase?: string } {
  if (seen.has(file)) return {}
  seen.add(file)
  const json = parseJsonc(readFileSync(file, 'utf8'))
  const dir = dirname(file)
  let inherited: ReturnType<typeof read> = {}
  for (const ext of [json.extends ?? []].flat() as string[]) {
    try {
      const from = ext.startsWith('.') ? resolve(dir, ext) : createRequire(file).resolve(ext)
      inherited = { ...inherited, ...read(existsSync(from) ? from : from + '.json', seen) }
    } catch {}
  }
  const o = json.compilerOptions ?? {}
  const baseUrl = o.baseUrl != null ? resolve(dir, o.baseUrl) : inherited.baseUrl
  return {
    baseUrl,
    paths: o.paths ?? inherited.paths,
    // Sem baseUrl, os alvos de `paths` são relativos ao tsconfig que os declara.
    pathsBase: o.paths ? (o.baseUrl != null ? baseUrl : dir) : inherited.pathsBase,
  }
}

const cache = new Map<string, PathsConfig | null>()

/**
 * O tsconfig mais próximo do arquivo `file`, se tiver `paths`. Um arquivo em
 * `node_modules` só usa o tsconfig do próprio pacote, nunca o do app.
 */
export function pathsFor(file: string): PathsConfig | null {
  const c = tsconfigFor(dirname(file))
  const n = (p: string) => p.replace(/\\/g, '/')
  return c && n(file).includes('/node_modules/') && !n(c.dir!).includes('/node_modules/') ? null : c
}

/** O tsconfig mais próximo de `dir` com `paths`, ou null. */
export function tsconfigFor(dir: string): PathsConfig | null {
  if (cache.has(dir)) return cache.get(dir)!
  const file = join(dir, 'tsconfig.json')
  let found: PathsConfig | null
  if (existsSync(file)) {
    try {
      const c = read(file)
      found = c.paths ? { dir, base: c.pathsBase ?? dir, paths: c.paths } : null
    } catch {
      found = null
    }
  } else found = dirname(dir) === dir ? null : tsconfigFor(dirname(dir))
  cache.set(dir, found)
  return found
}

export function clearTsconfigCache(): void {
  cache.clear()
}

/**
 * Caminhos para tentar, em ordem, ou nada se nenhum padrão casa. Um padrão
 * exato vale mais que um com `*`; entre os com `*`, o de prefixo mais longo.
 * O alvo que só aponta para o próprio pacote em `node_modules` volta a ser o
 * nome do pacote: a resolução normal chega lá com as condições de export certas.
 */
export function pathCandidates(id: string, c: PathsConfig): string[] | undefined {
  let best: { targets: string[]; rest: string; size: number } | undefined
  for (const [key, targets] of Object.entries(c.paths)) {
    const star = key.indexOf('*')
    if (star < 0 ? id !== key : !(id.startsWith(key.slice(0, star)) && id.endsWith(key.slice(star + 1)) && id.length >= key.length - 1)) continue
    const size = star < 0 ? Infinity : star
    if (!best || size > best.size) best = { targets, rest: star < 0 ? '' : id.slice(star, id.length - (key.length - star - 1)), size }
  }
  if (!best) return
  const out = best.targets.map((t) => {
    const path = resolve(c.base, t.replace('*', best!.rest))
    return path.replace(/\\/g, '/').endsWith(`/node_modules/${id}`) ? id : path
  })
  return out.every((t) => t === id) ? undefined : out
}

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']

/** O arquivo de um alvo de `paths`, como o TypeScript procura (extensões e `index`). */
function fileOf(path: string): string | undefined {
  for (const ext of EXTENSIONS) {
    try {
      if (statSync(path + ext).isFile()) return path + ext
    } catch {}
  }
}

/** `paths` do tsconfig do `importer`, já como arquivo. Sem `paths` que casem, nada. */
export function resolvePath(id: string, importer: string): string | undefined {
  const config = pathsFor(importer)
  const candidates = config && pathCandidates(id, config)
  for (const c of candidates ?? []) {
    if (c === id) return
    const file = fileOf(c)
    if (file) return file
  }
}

/**
 * Os mesmos `paths` no pré-bundle do Vite em dev, que não passa pelos plugins:
 * um pacote publicado como código-fonte com `@/` próprio é empacotado com
 * os imports certos. esbuild no Vite 5-7, Rolldown no Vite 8.
 */
export function optimizerPaths(rolldown: boolean): Record<string, unknown> {
  if (rolldown)
    return {
      rolldownOptions: {
        plugins: [{ name: 'vitral:paths', resolveId: (id: string, importer?: string) => (importer && !/^[./\0]/.test(id) ? resolvePath(id, importer) : undefined) }],
      },
    }
  return {
    esbuildOptions: {
      plugins: [
        {
          name: 'vitral:paths',
          setup(build: any) {
            build.onResolve({ filter: /^[^./]/ }, (args: { path: string; importer: string }) => {
              const file = args.importer && resolvePath(args.path, args.importer)
              return file ? { path: file } : undefined
            })
          },
        },
      ],
    },
  }
}
