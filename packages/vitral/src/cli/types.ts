import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface TypesOptions {
  /** Diretório do projeto. Padrão: `process.cwd()`. */
  cwd?: string
  /** `remotes.json` ou pares `nome=url`. Padrão: `public/remotes.json` ou `remotes.json`. */
  args?: string[]
  /** Base para urls relativas do `remotes.json`. */
  base?: string
  /** Arquivo gerado. Padrão: `vitral-env.d.ts`. */
  out?: string
  /**
   * Só confere: compara o hash de cada manifesto com o registrado no arquivo
   * gerado, sem reescrevê-lo. Devolve quantos remotes estão desatualizados.
   */
  check?: boolean
  fetch?: typeof fetch
  log?: (msg: string) => void
}

const PROPS = /export type Props =\s*([\s\S]*?)\s*$/

/** Lê o `export type Props = …` de um `vitral.d.ts`. */
export function parseProps(dts: string): string | null {
  return PROPS.exec(dts.replace(/^\s*\/\/.*$/gm, '').trim())?.[1]?.replace(/;$/, '') || null
}

const HASH = /^\/\/ vitral:hash ("(?:[^"\\]|\\.)*") (\S+)$/gm

/**
 * Monta o `vitral-env.d.ts` com a interface `Remotes` preenchida. `hashes`:
 * o `integrity` do manifesto de onde veio o tipo de cada remote, uma linha
 * `// vitral:hash` por remote (é o que o `--check` compara).
 */
export function envFile(props: Record<string, string>, hashes: Record<string, string> = {}): string {
  const lines = Object.entries(props).map(([name, type]) => `    ${JSON.stringify(name)}: ${type}`)
  const marks = Object.entries(hashes).map(([name, hash]) => `// vitral:hash ${JSON.stringify(name)} ${hash}\n`)
  return `// Gerado por \`npx vitral types\`. Não edite.\n${marks.join('')}import 'vitral'\n\ndeclare module 'vitral' {\n  interface Remotes {\n${lines.join('\n')}\n  }\n}\n`
}

/** Hashes registrados num `vitral-env.d.ts`: `{ nome: integrity }`. */
export function readHashes(env: string): Record<string, string> {
  return Object.fromEntries([...env.matchAll(HASH)].map((m) => [JSON.parse(m[1]) as string, m[2]]))
}

/** `integrity` do manifesto do remote, ou `undefined` sem manifesto/hash (ex.: `vite dev`). */
async function manifestHash(get: typeof fetch, url: string): Promise<string | undefined> {
  try {
    const res = await get(url)
    if (!res.ok) return undefined
    const { integrity } = (await res.json()) as { integrity?: unknown }
    return typeof integrity === 'string' ? integrity : undefined
  } catch {
    return undefined
  }
}

/** `--check`: conta os remotes cujo manifesto mudou desde o último `vitral types`. */
async function check(remotes: Record<string, string>, out: string, get: typeof fetch, log: (msg: string) => void): Promise<number> {
  if (!existsSync(out)) {
    log(`[vitral] ${out} não existe. Rode \`npx vitral types\`.`)
    return 1
  }
  const recorded = readHashes(readFileSync(out, 'utf8'))
  let stale = 0
  for (const [name, url] of Object.entries(remotes)) {
    const hash = await manifestHash(get, url)
    if (!hash) log(`[vitral] ${name}: manifesto sem hash, não deu para conferir.`)
    else if (recorded[name] !== hash) {
      log(`[vitral] ${name}: tipos desatualizados (${recorded[name] ? 'o manifesto mudou' : 'sem hash registrado'}).`)
      stale++
    }
  }
  for (const name of Object.keys(recorded)) {
    if (!(name in remotes)) {
      log(`[vitral] ${name}: não está mais no remotes.json.`)
      stale++
    }
  }
  log(stale ? `[vitral] ${stale} remote(s) com tipos desatualizados. Rode \`npx vitral types\`.` : `[vitral] tipos em dia com os manifestos.`)
  return stale
}

function readRemotes(cwd: string, args: string[], base?: string): Record<string, string> {
  const pairs = args.filter((a) => a.includes('='))
  if (pairs.length) return Object.fromEntries(pairs.map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]))
  const file = [args[0], 'public/remotes.json', 'remotes.json'].find((f) => f && existsSync(resolve(cwd, f)))
  if (!file) throw new Error('[vitral] remotes.json não encontrado. Passe o caminho ou pares nome=url.')
  const map = JSON.parse(readFileSync(resolve(cwd, file), 'utf8')) as Record<string, string | { url: string }>
  return Object.fromEntries(
    Object.entries(map).map(([name, v]) => {
      const url = typeof v === 'string' ? v : v.url
      return [name, base ? new URL(url, base).href : url]
    }),
  )
}

/**
 * `npx vitral types`: baixa o `vitral.d.ts` de cada remote e gera
 * `vitral-env.d.ts`, com o hash do manifesto de onde veio cada tipo. Com
 * `check`, só confere esses hashes (para o CI).
 */
export async function types(options: TypesOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const get = options.fetch ?? fetch
  const log = options.log ?? console.log
  const remotes = readRemotes(cwd, options.args ?? [], options.base)
  const out = resolve(cwd, options.out ?? 'vitral-env.d.ts')
  if (options.check) return check(remotes, out, get, log)
  const props: Record<string, string> = {}
  const hashes: Record<string, string> = {}
  let falhas = 0
  for (const [name, url] of Object.entries(remotes)) {
    let dts: string
    try {
      const res = await get(new URL('vitral.d.ts', url).href)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      dts = await res.text()
    } catch (err) {
      log(`[vitral] ${name}: sem tipos (${(err as Error).message}).`)
      falhas++
      continue
    }
    const type = parseProps(dts)
    if (!type) {
      log(`[vitral] ${name}: vitral.d.ts sem "export type Props".`)
      continue
    }
    props[name] = type
    const hash = await manifestHash(get, url)
    if (hash) hashes[name] = hash
  }
  writeFileSync(out, envFile(props, hashes))
  log(`[vitral] ${Object.keys(props).length} remote(s) em ${out}`)
  return falhas
}
