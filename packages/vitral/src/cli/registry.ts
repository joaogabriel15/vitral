/**
 * Registro de remotes: um `vitral-registry.json` lista os remotes que uma
 * empresa publica (nome, manifesto, versão, tipo das props, dono, hash e
 * framework). `npx vitral registry` gera o arquivo a partir dos manifestos;
 * `npx vitral add <remote>` copia um remote dele para o `remotes.json` do
 * host e roda `vitral types`. O formato está em `vitral-registry.json` no
 * site da documentação (JSON Schema).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { manifestHash, parseProps, readRemotes, types } from './types'

/** Endereço do JSON Schema do registro. Vai no `$schema` do arquivo gerado. */
export const REGISTRY_SCHEMA = 'https://joaogabriel15.github.io/vitral/schema/vitral-registry.json'

/** Um remote do registro. */
export interface RegistryItem {
  /** Nome usado no host (`<Remote name="carrinho">`). */
  name: string
  /** URL do `vitral.json`. Relativa vale a partir do endereço do registro. */
  url: string
  /** Versão publicada (`version` do manifesto). */
  version?: string
  /** Tipo TypeScript das props, lido do `vitral.d.ts` (`{ userId: number }`). */
  props?: string
  /** Time ou pessoa responsável. */
  owner?: string
  /** `integrity` do manifesto quando o registro foi gerado. */
  integrity?: string
  /** Framework do remote (`react`, `vue`, `svelte`, `element`…). */
  framework?: string
  /** Uma frase sobre o que o remote mostra. */
  description?: string
}

export interface Registry {
  $schema?: string
  /** Nome do registro (a empresa ou o time). */
  name?: string
  remotes: RegistryItem[]
}

/** Campos de um item. O teste confere que o JSON Schema publicado é o mesmo. */
export const ITEM_FIELDS = ['name', 'url', 'version', 'props', 'owner', 'integrity', 'framework', 'description'] as const

const NAME = /^[^/\s]+$/

/** Confere o formato do registro. Devolve a lista de problemas (vazia se está certo). */
export function checkRegistry(data: unknown): string[] {
  const errors: string[] = []
  const reg = data as Partial<Registry> | null
  if (!reg || typeof reg !== 'object' || !Array.isArray(reg.remotes)) return ['falta a lista "remotes"']
  for (const key of Object.keys(reg)) if (!['$schema', 'name', 'remotes'].includes(key)) errors.push(`campo desconhecido "${key}"`)
  const seen = new Set<string>()
  reg.remotes.forEach((item, i) => {
    const at = `remotes[${i}]`
    if (!item || typeof item !== 'object') return errors.push(`${at}: não é um objeto`)
    if (typeof item.name !== 'string' || !NAME.test(item.name)) errors.push(`${at}: "name" inválido`)
    else if (seen.has(item.name)) errors.push(`${at}: "${item.name}" repetido`)
    else seen.add(item.name)
    if (typeof item.url !== 'string' || !item.url) errors.push(`${at}: falta "url"`)
    for (const key of Object.keys(item)) {
      if (!(ITEM_FIELDS as readonly string[]).includes(key)) errors.push(`${at}: campo desconhecido "${key}"`)
      else if (typeof (item as unknown as Record<string, unknown>)[key] !== 'string') errors.push(`${at}: "${key}" deve ser texto`)
    }
  })
  return errors
}

const isUrl = (s: string) => /^https?:\/\//.test(s)

/**
 * Lê um registro de uma URL ou de um arquivo. URLs relativas dos itens
 * passam a valer a partir do endereço do registro.
 */
export async function loadRegistry(source: string, cwd = process.cwd(), get: typeof fetch = fetch): Promise<Registry> {
  let data: unknown
  if (isUrl(source)) {
    const res = await get(source)
    if (!res.ok) throw new Error(`[vitral] registro ${source}: HTTP ${res.status}`)
    data = await res.json()
  } else {
    const file = resolve(cwd, source)
    if (!existsSync(file)) throw new Error(`[vitral] registro ${source} não encontrado.`)
    data = JSON.parse(readFileSync(file, 'utf8'))
  }
  const errors = checkRegistry(data)
  if (errors.length) throw new Error(`[vitral] registro ${source} inválido:\n  ${errors.join('\n  ')}`)
  const reg = data as Registry
  if (isUrl(source)) for (const item of reg.remotes) item.url = new URL(item.url, source).href
  return reg
}

/** Registro padrão: `VITRAL_REGISTRY` ou `vitral-registry.json` no projeto. */
export const defaultRegistry = (): string => process.env.VITRAL_REGISTRY || 'vitral-registry.json'

export interface RegistryOptions {
  cwd?: string
  /** `remotes.json` ou pares `nome=url`, como em `vitral types`. */
  args?: string[]
  base?: string
  /** Arquivo gerado. Padrão: `vitral-registry.json`. */
  out?: string
  /** Nome do registro. */
  name?: string
  fetch?: typeof fetch
  log?: (msg: string) => void
}

/**
 * `npx vitral registry`: monta o `vitral-registry.json` a partir dos
 * manifestos e do `vitral.d.ts` de cada remote. `owner`, `framework` e
 * `description` não estão no manifesto: são mantidos do arquivo anterior.
 * Devolve quantos remotes falharam.
 */
export async function registry(options: RegistryOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const get = options.fetch ?? fetch
  const log = options.log ?? console.log
  const out = resolve(cwd, options.out ?? 'vitral-registry.json')
  const before = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as Registry) : undefined
  const old = new Map((before?.remotes ?? []).map((item) => [item.name, item]))
  const remotes: RegistryItem[] = []
  let falhas = 0
  for (const [name, url] of Object.entries(readRemotes(cwd, options.args ?? [], options.base))) {
    let manifest: { version?: unknown; integrity?: unknown }
    try {
      const res = await get(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      manifest = (await res.json()) as typeof manifest
    } catch (err) {
      log(`[vitral] ${name}: manifesto indisponível (${(err as Error).message}).`)
      falhas++
      continue
    }
    let props: string | null = null
    try {
      const res = await get(new URL('vitral.d.ts', url).href)
      if (res.ok) props = parseProps(await res.text())
    } catch {
      // remote sem tipos publicados
    }
    const { owner, framework, description } = old.get(name) ?? {}
    remotes.push(
      clean({
        name,
        url,
        version: typeof manifest.version === 'string' ? manifest.version : undefined,
        props: props ?? undefined,
        owner,
        integrity: typeof manifest.integrity === 'string' ? manifest.integrity : undefined,
        framework,
        description,
      }),
    )
  }
  const result: Registry = { $schema: REGISTRY_SCHEMA, ...((options.name ?? before?.name) && { name: options.name ?? before?.name }), remotes }
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n')
  log(`[vitral] ${remotes.length} remote(s) em ${out}`)
  return falhas
}

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export interface AddOptions {
  cwd?: string
  /** Remotes a adicionar, pelo nome no registro. */
  names: string[]
  /** URL ou arquivo do registro. Padrão: `VITRAL_REGISTRY` ou `vitral-registry.json`. */
  registry?: string
  /** `remotes.json` do host. Padrão: o que existir entre `public/remotes.json` e `remotes.json`. */
  to?: string
  /** Base das URLs relativas, repassada para `vitral types`. */
  base?: string
  /** Arquivo de tipos, repassado para `vitral types`. */
  out?: string
  /** Troca a URL de um remote que já está no `remotes.json`. */
  force?: boolean
  /** `false` não roda `vitral types` depois. */
  types?: boolean
  fetch?: typeof fetch
  log?: (msg: string) => void
}

/** `remotes.json` do host: o primeiro que existir, ou `public/remotes.json` se houver `public/`. */
function remotesFile(cwd: string, to?: string): string {
  if (to) return resolve(cwd, to)
  const found = ['public/remotes.json', 'remotes.json'].find((f) => existsSync(resolve(cwd, f)))
  return resolve(cwd, found ?? (existsSync(resolve(cwd, 'public')) ? 'public/remotes.json' : 'remotes.json'))
}

/**
 * `npx vitral add <remote>`: copia remotes do registro para o `remotes.json`
 * do host e roda `vitral types`. Devolve quantos remotes falharam (não
 * achados, já registrados com outra URL ou sem tipos).
 */
export async function add(options: AddOptions): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const get = options.fetch ?? fetch
  const log = options.log ?? console.log
  if (!options.names.length) throw new Error('[vitral] informe o nome do remote: npx vitral add <remote>')
  const reg = await loadRegistry(options.registry ?? defaultRegistry(), cwd, get)
  const file = remotesFile(cwd, options.to)
  const map = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string | { url: string }>) : {}
  let falhas = 0
  let added = 0
  for (const name of options.names) {
    const item = reg.remotes.find((r) => r.name === name)
    if (!item) {
      log(`[vitral] ${name}: não está no registro. Disponíveis: ${reg.remotes.map((r) => r.name).join(', ') || 'nenhum'}.`)
      falhas++
      continue
    }
    const current = map[name]
    const currentUrl = typeof current === 'string' ? current : current?.url
    if (currentUrl && currentUrl !== item.url && !options.force) {
      log(`[vitral] ${name}: já está no remotes.json com ${currentUrl}. Use --force para trocar.`)
      falhas++
      continue
    }
    if (item.integrity) {
      const hash = await manifestHash(get, options.base ? new URL(item.url, options.base).href : item.url)
      if (hash && hash !== item.integrity) log(`[vitral] ${name}: o manifesto publicado mudou desde que o registro foi gerado.`)
    }
    // Uma entrada em objeto (com `isolate`, `contract`…) mantém as outras opções.
    map[name] = current && typeof current === 'object' ? { ...current, url: item.url } : item.url
    added++
    log(`[vitral] ${name}${item.version ? `@${item.version}` : ''} adicionado em ${file}`)
  }
  if (added) {
    writeFileSync(file, JSON.stringify(map, null, 2) + '\n')
    if (options.types !== false) falhas += await types({ cwd, args: [file], base: options.base, out: options.out, fetch: get, log })
  }
  return falhas
}
