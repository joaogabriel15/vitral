/**
 * `npx vitral test`, no CI do remote:
 *
 * - `--contract arquivo`: monta o build do remote em happy-dom com cada caso
 *   que o host gravou (`record()` de `vitral/testing`) e falha se algum
 *   quebrar: erro no mount/update, evento que o host escuta sumiu, ou props
 *   gravadas que não batem mais com o `Props` do `vitral.d.ts` local.
 * - `--since url`: compara o `Props` do `vitral.d.ts` publicado com o local e
 *   lista o que quebra o host.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type * as TS from 'typescript'
import { verify, type Contract } from '../harness'
import type { Props, RemoteModule } from '../core/types'
import { loadTs } from '../vite/types'
import { parseProps } from './types'

export interface TestOptions {
  /** Diretório do projeto. Padrão: `process.cwd()`. */
  cwd?: string
  /** Arquivos `.contract.json`, ou pastas com eles. */
  contracts?: string[]
  /** Pasta do build, com `vitral.json` e `vitral.d.ts`. Padrão `dist`. */
  dir?: string
  /** Módulo JS do remote. Padrão: o `entry` de `<dir>/vitral.json`. */
  entry?: string
  /** `vitral.d.ts` publicado (URL ou arquivo; URL do `vitral.json` ou da pasta também vale). */
  since?: string
  /** `vitral.d.ts` local. Padrão `<dir>/vitral.d.ts`. */
  types?: string
  fetch?: typeof fetch
  log?: (msg: string) => void
}

// ---------------------------------------------------------------------------
// TypeScript em memória
// ---------------------------------------------------------------------------

interface Diag {
  code: number
  text: string
}

const FILE = '/__vitral_check__.ts'

/** Checa cada trecho em um namespace próprio de um arquivo só e devolve os erros de cada um. */
export function typeErrors(ts: typeof TS, snippets: string[]): Diag[][] {
  let code = ''
  const starts: number[] = []
  snippets.forEach((s, i) => {
    starts.push(code.length)
    code += `namespace __c${i} {\n${s}\n}\n`
  })
  const options: TS.CompilerOptions = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, skipLibCheck: true, types: [] }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile
  host.getSourceFile = (name, lang, ...rest) => (name === FILE ? ts.createSourceFile(name, code, lang) : getSourceFile.call(host, name, lang, ...rest))
  const fileExists = host.fileExists
  host.fileExists = (name) => name === FILE || fileExists.call(host, name)
  const program = ts.createProgram([FILE], options, host)
  const out: Diag[][] = snippets.map(() => [])
  for (const d of [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()]) {
    if (d.file?.fileName !== FILE || d.start === undefined) continue
    let i = starts.length - 1
    while (i > 0 && starts[i] > d.start) i--
    out[i].push({ code: d.code, text: ts.flattenDiagnosticMessageText(d.messageText, ' ') })
  }
  return out
}

interface Field {
  optional: boolean
  type: string
}

/** Campos de primeiro nível de um tipo objeto (`{ a: number; b?: string }`), ou `null`. */
export function propFields(ts: typeof TS, type: string): Map<string, Field> | null {
  const src = ts.createSourceFile('p.ts', `type P = ${type}`, ts.ScriptTarget.ES2022, true)
  const alias = src.statements[0]
  if (!alias || !ts.isTypeAliasDeclaration(alias) || !ts.isTypeLiteralNode(alias.type)) return null
  const fields = new Map<string, Field>()
  for (const m of alias.type.members) {
    if (!ts.isPropertySignature(m) || !m.type) return null
    const name = ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) ? m.name.text : m.name.getText(src)
    fields.set(name, { optional: !!m.questionToken, type: m.type.getText(src) })
  }
  return fields
}

export interface PropsDiff {
  /** Mudanças que quebram o host. */
  breaking: string[]
  /** Mudanças compatíveis. */
  compatible: string[]
}

/**
 * O que mudou de `before` para `after` (texto do `Props`). Quebra: prop
 * obrigatória nova, opcional que virou obrigatória, prop removida (o host
 * que ainda passa não compila) e tipo que não aceita mais o valor antigo.
 * Sem TypeScript, qualquer mudança conta como quebra.
 */
export function diffProps(before: string, after: string, ts: typeof TS | null): PropsDiff {
  const breaking: string[] = []
  const compatible: string[] = []
  const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/;\s*}/g, ' }').trim()
  if (norm(before) === norm(after)) return { breaking, compatible }
  if (!ts) return { breaking: [`Props mudou (sem TypeScript para detalhar): ${norm(before)} → ${norm(after)}`], compatible }
  const old = propFields(ts, before)
  const now = propFields(ts, after)
  if (!old || !now) {
    const [errors] = typeErrors(ts, [`type O = ${before}\ntype N = ${after}\ndeclare const o: O\nexport const n: N = o`])
    ;(errors.length ? breaking : compatible).push(`Props mudou: ${norm(before)} → ${norm(after)}`)
    return { breaking, compatible }
  }
  const changed: [string, Field, Field][] = []
  for (const [name, f] of now) {
    const was = old.get(name)
    if (!was) (f.optional ? compatible : breaking).push(`${f.optional ? 'prop opcional nova' : 'prop obrigatória nova'}: ${name}: ${f.type}`)
    else {
      if (was.optional && !f.optional) breaking.push(`${name} virou obrigatória`)
      if (!was.optional && f.optional) compatible.push(`${name} virou opcional`)
      if (norm(was.type) !== norm(f.type)) changed.push([name, was, f])
    }
  }
  for (const [name, f] of old) if (!now.has(name)) breaking.push(`prop removida: ${name}: ${f.type} (o host que ainda passa ${name} não compila)`)
  const results = typeErrors(
    ts,
    changed.map(([, was, f]) => `type O = ${was.type}\ntype N = ${f.type}\ndeclare const o: O\nexport const n: N = o`),
  )
  changed.forEach(([name, was, f], i) => {
    if (results[i].length) breaking.push(`tipo de ${name} mudou: ${norm(was.type)} → ${norm(f.type)} (${results[i][0].text})`)
    else compatible.push(`tipo de ${name} aceita mais valores: ${norm(was.type)} → ${norm(f.type)}`)
  })
  return { breaking, compatible }
}

/** Valor gravado como expressão TypeScript (os marcadores viram `any`). */
export function tsLiteral(value: unknown): string {
  if (value === null || typeof value !== 'object') return value === undefined ? 'undefined' : JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(tsLiteral).join(', ')}]`
  const v = value as Record<string, unknown>
  if (v.$fn === true) return '((..._a: any[]): any => undefined)'
  if (typeof v.$date === 'string') return `new Date(${JSON.stringify(v.$date)})`
  if (typeof v.$unknown === 'string') return '(undefined as any)'
  return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${tsLiteral(x)}`).join(', ')} }`
}

// Código de "propriedade a mais num literal": o host passa algo que o remote não declara.
const EXCESS = new Set([2353, 2561])

/**
 * Confere as props de cada caso (mount e updates) contra o `Props` local.
 * Prop que o host passa e o remote não declara é aviso, não falha: ela sai
 * do literal antes da checagem, senão o erro de "propriedade a mais"
 * esconderia o de prop obrigatória que falta.
 */
export function checkCaseProps(contract: Contract, props: string, ts: typeof TS): { failures: string[]; warnings: string[] } {
  const failures: string[] = []
  const warnings: string[] = []
  const fields = propFields(ts, props)
  const all: { at: string; value: Props }[] = []
  contract.cases.forEach((c, i) => {
    all.push({ at: `caso ${i + 1}`, value: c.props })
    c.updates?.forEach((u, j) => all.push({ at: `caso ${i + 1}, update ${j + 1}`, value: u }))
  })
  const extra = (at: string, what: string) => warnings.push(`${at}: o host passa uma prop que o remote não declara: ${what}`)
  const values = all.map(({ at, value }) => {
    if (!fields || !value || typeof value !== 'object') return value
    const known = Object.entries(value).filter(([k]) => fields.has(k) || (extra(at, k), false))
    return Object.fromEntries(known)
  })
  const results = typeErrors(
    ts,
    values.map((value) => `type Props = ${props}\nexport const p: Props = ${tsLiteral(value)}`),
  )
  results.forEach((errors, i) => {
    for (const e of errors) {
      if (EXCESS.has(e.code)) extra(all[i].at, e.text)
      else failures.push(`${all[i].at}: props não batem com o Props local: ${e.text}`)
    }
  })
  return { failures, warnings }
}

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

/** Põe `document`, `window`, `HTMLElement`… do happy-dom no `globalThis`. Devolve a função que fecha. */
export async function installDom(cwd: string): Promise<() => Promise<void>> {
  let mod: any
  try {
    mod = await import(pathToFileURL(createRequire(join(cwd, 'package.json')).resolve('happy-dom')).href)
  } catch {
    try {
      mod = await import('happy-dom')
    } catch {
      throw new Error('[vitral] vitral test precisa do happy-dom: npm i -D happy-dom')
    }
  }
  const win = new mod.Window({ url: 'http://localhost/' })
  const g = globalThis as Record<string, unknown>
  // Os do Node (timers, fetch, URL…) ficam; os do DOM entram.
  const dom = new Set(['Event', 'EventTarget', 'CustomEvent', 'MessageEvent', 'DOMException', 'navigator', 'window', 'self'])
  const before = new Map<string, PropertyDescriptor | undefined>()
  for (const key of Object.getOwnPropertyNames(win)) {
    if (key in g && !dom.has(key)) continue
    const desc = Object.getOwnPropertyDescriptor(g, key)
    if (desc && !desc.configurable) continue
    before.set(key, desc)
    Object.defineProperty(g, key, { value: win[key], configurable: true, writable: true })
  }
  return async () => {
    await win.happyDOM?.close?.()
    for (const [key, desc] of before) {
      if (desc) Object.defineProperty(g, key, desc)
      else delete g[key]
    }
  }
}

/** Arquivos `.contract.json` dados, e os de cada pasta. */
function contractFiles(cwd: string, paths: string[]): string[] {
  return paths.flatMap((p) => {
    const abs = resolve(cwd, p)
    if (!existsSync(abs)) throw new Error(`[vitral] contrato não encontrado: ${p}`)
    return statSync(abs).isDirectory()
      ? readdirSync(abs)
          .filter((f) => f.endsWith('.contract.json'))
          .sort()
          .map((f) => join(abs, f))
      : [abs]
  })
}

/** Texto dos arquivos JS da pasta do build (para achar eventos pelo nome). */
function sourcesIn(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      if (f.name === 'node_modules') continue
      const p = join(d, f.name)
      if (f.isDirectory()) walk(p)
      else if (/\.[cm]?js$/.test(f.name)) out.push(readFileSync(p, 'utf8'))
    }
  }
  walk(dir)
  return out
}

/** URL ou caminho do `vitral.d.ts` publicado, a partir do que a pessoa passou. */
export function publishedTypes(since: string, cwd: string): string {
  if (/^https?:\/\//.test(since)) {
    if (since.endsWith('.d.ts')) return since
    return new URL('vitral.d.ts', since.endsWith('.json') || since.endsWith('/') ? since : since + '/').href
  }
  const abs = resolve(cwd, since)
  return existsSync(abs) && statSync(abs).isDirectory() ? join(abs, 'vitral.d.ts') : abs
}

async function readText(where: string, get: typeof fetch): Promise<string> {
  if (!/^https?:\/\//.test(where)) return readFileSync(where, 'utf8')
  const res = await get(where)
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${where}`)
  return res.text()
}

// ---------------------------------------------------------------------------
// Comando
// ---------------------------------------------------------------------------

/** `npx vitral test`. Devolve quantas falhas houve (0 = passou). */
export async function test(options: TestOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const log = options.log ?? console.log
  const get = options.fetch ?? fetch
  const dir = resolve(cwd, options.dir ?? 'dist')
  if (!options.contracts?.length && !options.since) throw new Error('[vitral] passe --contract arquivo e/ou --since url. Veja `vitral --help`.')
  const localFile = resolve(cwd, options.types ?? join(dir, 'vitral.d.ts'))
  const local = existsSync(localFile) ? parseProps(readFileSync(localFile, 'utf8')) : null
  let ts: typeof TS | null | undefined
  const typescript = async () => (ts === undefined ? (ts = await loadTs(cwd)) : ts)
  let failures = 0

  if (options.since) {
    const where = publishedTypes(options.since, cwd)
    if (!local) throw new Error(`[vitral] sem Props local em ${localFile}. Rode o build com o plugin, ou passe --types.`)
    const before = parseProps(await readText(where, get))
    if (!before) throw new Error(`[vitral] ${where} sem "export type Props".`)
    const diff = diffProps(before, local, await typescript())
    for (const c of diff.breaking) log(`✗ quebra: ${c}`)
    for (const c of diff.compatible) log(`✓ compatível: ${c}`)
    log(diff.breaking.length ? `[vitral] ${diff.breaking.length} mudança(s) nas props que quebram o host (desde ${where}).` : `[vitral] props compatíveis com ${where}.`)
    failures += diff.breaking.length
  }

  if (options.contracts?.length) {
    const files = contractFiles(cwd, options.contracts)
    let entry = options.entry && resolve(cwd, options.entry)
    if (!entry) {
      const manifest = join(dir, 'vitral.json')
      if (!existsSync(manifest)) throw new Error(`[vitral] ${manifest} não existe. Rode o build ou passe --entry.`)
      entry = resolve(dir, (JSON.parse(readFileSync(manifest, 'utf8')) as { entry: string }).entry)
    }
    const close = typeof document === 'undefined' ? await installDom(cwd) : undefined
    try {
      const mod = (await import(pathToFileURL(entry).href)) as RemoteModule | { default: RemoteModule }
      const sources = sourcesIn(dirname(entry))
      const tsApi = local ? await typescript() : null
      if (!local) log(`[vitral] sem Props local em ${localFile}: as props gravadas não foram conferidas pelo tipo.`)
      else if (!tsApi) log('[vitral] sem TypeScript no projeto: as props gravadas não foram conferidas pelo tipo.')
      for (const file of files) {
        const contract = JSON.parse(readFileSync(file, 'utf8')) as Contract
        const result = await verify(contract, mod, { sources })
        if (local && tsApi) {
          const typed = checkCaseProps(contract, local, tsApi)
          result.failures.push(...typed.failures)
          result.warnings.push(...typed.warnings)
        }
        const who = `${contract.remote}${contract.host ? ` (host ${contract.host})` : ''}`
        for (const w of result.warnings) log(`! ${who}: ${w}`)
        for (const f of result.failures) log(`✗ ${who}: ${f}`)
        log(result.failures.length ? `[vitral] ${file}: ${result.failures.length} falha(s) em ${result.cases} caso(s).` : `[vitral] ${file}: ${result.cases} caso(s) passaram.`)
        failures += result.failures.length
      }
    } finally {
      await close?.()
    }
  }
  return failures
}
