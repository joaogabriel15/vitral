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
  fetch?: typeof fetch
  log?: (msg: string) => void
}

const PROPS = /export type Props =\s*([\s\S]*?)\s*$/

/** Lê o `export type Props = …` de um `vitral.d.ts`. */
export function parseProps(dts: string): string | null {
  return PROPS.exec(dts.replace(/^\s*\/\/.*$/gm, '').trim())?.[1]?.replace(/;$/, '') || null
}

/** Monta o `vitral-env.d.ts` com a interface `Remotes` preenchida. */
export function envFile(props: Record<string, string>): string {
  const lines = Object.entries(props).map(([name, type]) => `    ${JSON.stringify(name)}: ${type}`)
  return `// Gerado por \`npx vitral types\`. Não edite.\nimport 'vitral'\n\ndeclare module 'vitral' {\n  interface Remotes {\n${lines.join('\n')}\n  }\n}\n`
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

/** `npx vitral types`: baixa o `vitral.d.ts` de cada remote e gera `vitral-env.d.ts`. */
export async function types(options: TypesOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const get = options.fetch ?? fetch
  const log = options.log ?? console.log
  const remotes = readRemotes(cwd, options.args ?? [], options.base)
  const props: Record<string, string> = {}
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
    if (type) props[name] = type
    else log(`[vitral] ${name}: vitral.d.ts sem "export type Props".`)
  }
  const out = resolve(cwd, options.out ?? 'vitral-env.d.ts')
  writeFileSync(out, envFile(props))
  log(`[vitral] ${Object.keys(props).length} remote(s) em ${out}`)
  return falhas
}
