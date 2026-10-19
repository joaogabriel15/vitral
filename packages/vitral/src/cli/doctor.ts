/**
 * `npx vitral doctor`: baixa o manifesto e o JS de cada remote, como o host
 * faria, e explica o que impede o carregamento (CORS, CSP, `mount`,
 * integrity, contrato, `dedupe`, tamanho). Não executa o código do remote.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { RemoteManifest } from '../core/types'
import { entriesOf, flag, readEntries, type RemoteJson } from './types'

export interface DoctorOptions {
  /** Diretório do projeto host. Padrão: `process.cwd()`. */
  cwd?: string
  /** `remotes.json` (caminho ou URL), URL de um `vitral.json` ou pares `nome=url`. */
  args?: string[]
  /** Base para urls relativas do `remotes.json`. Padrão: `host`. */
  base?: string
  /** URL da página do host: dela saem a origem (CORS) e a CSP. */
  host?: string
  /** Origem do host para conferir CORS, se diferente da de `host`. */
  origin?: string
  /** Faixa de contrato que o host aceita (como em `configure({ contract })`). */
  contract?: string
  /** Tamanho máximo do JS do remote, em kB com gzip. Acima disso é erro. */
  maxKb?: number
  /** Tempo máximo de cada download, em ms. Padrão 15000. */
  timeout?: number
  fetch?: typeof fetch
}

export type Status = 'ok' | 'warn' | 'error'

export interface Check {
  status: Status
  /** O que foi conferido e o resultado, numa linha. */
  title: string
  /** Por que isso quebra (ou pode quebrar) o carregamento. */
  cause?: string
  /** O que fazer. */
  fix?: string
}

export interface DoctorReport {
  ok: boolean
  errors: number
  warnings: number
  host: Check[]
  remotes: { name: string; url: string; checks: Check[] }[]
}

/** Acima disto (gzip), o tamanho vira aviso quando não há `maxKb`. */
const WARN_KB = 250
/** Origem usada no CORS quando o host não foi informado. */
const ANY_ORIGIN = 'https://host.invalid'

// Import estático do semver separaria esse código num chunk novo, que os
// hosts também baixariam junto com o de `dedupe`. Vem do mesmo chunk, sob demanda.
let satisfies: (version: string, range: string) => boolean

const ok = (title: string): Check => ({ status: 'ok', title })
const warn = (title: string, cause?: string, fix?: string): Check => ({ status: 'warn', title, cause, fix })
const error = (title: string, cause?: string, fix?: string): Check => ({ status: 'error', title, cause, fix })
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

interface Got {
  res?: Response
  bytes?: Uint8Array
  /** Motivo da falha de rede (DNS, conexão recusada, timeout). */
  failure?: string
}

/** Baixa `url` como o navegador faria a partir do host (com `Origin`). */
async function get(f: typeof fetch, url: string, origin: string, timeout: number): Promise<Got> {
  try {
    const res = await f(url, { headers: { Origin: origin }, signal: AbortSignal.timeout(timeout) })
    return { res, bytes: new Uint8Array(await res.arrayBuffer()) }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } }
    return { failure: err.name === 'TimeoutError' ? `sem resposta em ${timeout} ms` : (err.cause?.code ?? err.cause?.message ?? err.message) }
  }
}

/** CORS de um arquivo que o host baixa de outra origem. */
function cors(what: string, url: string, res: Response, origin: string, known: boolean): Check | undefined {
  if (new URL(url).origin === origin) return
  const allow = res.headers.get('access-control-allow-origin')
  if (allow === '*' || allow === origin) return ok(`CORS do ${what}: Access-Control-Allow-Origin ${allow}`)
  if (!allow)
    return error(
      `CORS do ${what}: a resposta não tem Access-Control-Allow-Origin`,
      `o navegador bloqueia ${url} lido a partir de ${known ? origin : 'outra origem'}.`,
      `configure o servidor de ${new URL(url).origin} para responder Access-Control-Allow-Origin: ${known ? origin : '*'} (ou *).`,
    )
  return (known ? error : warn)(
    `CORS do ${what}: Access-Control-Allow-Origin é ${allow}`,
    `o navegador só libera ${url} para ${allow}${known ? `, e o host está em ${origin}` : ''}.`,
    known ? `inclua ${origin} na resposta do servidor (ou use *).` : 'confira se é a origem do host, ou rode com --host/--origin.',
  )
}

// ---------- CSP ----------

type Policy = { source: string; directives: Map<string, string[]> }

export function parseCsp(text: string, source: string): Policy {
  const directives = new Map<string, string[]>()
  for (const part of text.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/)
    if (name && !directives.has(name.toLowerCase())) directives.set(name.toLowerCase(), values)
  }
  return { source, directives }
}

/** Lista que vale para `directive`, com o fallback da especificação. */
function sources(p: Policy, ...chain: string[]): { name: string; list: string[] } | undefined {
  for (const name of [...chain, 'default-src']) {
    const list = p.directives.get(name)
    if (list) return { name, list }
  }
}

/** `url` é permitida por alguma fonte da lista? `self` é a origem do host. */
export function cspAllows(list: string[], url: string, self?: string): boolean {
  const u = new URL(url)
  return list.some((raw) => {
    const s = raw.toLowerCase()
    if (s === "'none'") return false
    if (s === "'self'") return !!self && u.origin === new URL(self).origin
    if (s === '*') return /^(https?|wss?):$/.test(u.protocol)
    if (/^[a-z][a-z0-9+.-]*:$/.test(s)) return u.protocol === s || (s === 'http:' && u.protocol === 'https:')
    const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+|\*)(?::(\d+|\*))?(\/.*)?$/.exec(s)
    if (!m || s.startsWith("'")) return false
    const [, scheme, wild, host, port, path] = m
    if (scheme && u.protocol !== `${scheme}:` && !(scheme === 'http' && u.protocol === 'https:')) return false
    if (!scheme && self && new URL(self).protocol === 'https:' && u.protocol !== 'https:') return false
    if (wild ? !u.hostname.endsWith(`.${host}`) : host !== '*' && u.hostname !== host) return false
    const def = u.protocol === 'https:' ? '443' : '80'
    if (port !== '*' && (port ?? def) !== (u.port || def)) return false
    if (path) return path.endsWith('/') ? u.pathname.startsWith(path) : u.pathname === path
    return true
  })
}

/** CSP do host: header e `<meta>` da página `host`, ou o `index.html` do projeto. */
async function hostPolicies(f: typeof fetch, cwd: string, host: string | undefined, timeout: number, out: Check[]): Promise<Policy[]> {
  const meta = (html: string) =>
    [...html.matchAll(/<meta\s[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi)].map((m) => /content=(["'])([\s\S]*?)\1/i.exec(m[0])?.[2] ?? '')
  const policies: Policy[] = []
  if (host) {
    const { res, bytes, failure } = await get(f, host, new URL(host).origin, timeout)
    if (!res?.ok) {
      out.push(warn(`CSP: não foi possível abrir ${host} (${failure ?? `HTTP ${res!.status}`})`, undefined, 'confira a URL de --host.'))
      return policies
    }
    for (const h of (res.headers.get('content-security-policy') ?? '').split(',')) if (h.trim()) policies.push(parseCsp(h, `header de ${host}`))
    for (const c of meta(new TextDecoder().decode(bytes))) policies.push(parseCsp(c, `<meta> de ${host}`))
  } else {
    const file = ['index.html', 'public/index.html', 'src/index.html'].map((p) => resolve(cwd, p)).find((p) => existsSync(p))
    if (file) for (const c of meta(readFileSync(file, 'utf8'))) policies.push(parseCsp(c, `<meta> de ${file}`))
  }
  out.push(
    policies.length
      ? ok(`CSP encontrada (${policies.map((p) => p.source).join(', ')})`)
      : ok(`CSP: nenhuma encontrada ${host ? `em ${host}` : 'no index.html'}${host ? '' : ' (passe --host para ler o header da página)'}`),
  )
  return policies
}

/** O que a CSP do host precisa liberar para este remote. */
function cspChecks(policies: Policy[], self: string | undefined, m: RemoteManifest, manifestUrl: string, js: string, css: string[]): Check[] {
  const out: Check[] = []
  for (const p of policies) {
    const missing: string[] = []
    const script = sources(p, 'script-src-elem', 'script-src')
    const connect = sources(p, 'connect-src')
    const strict = script?.list.includes("'strict-dynamic'")
    // Com 'strict-dynamic', import() de um script confiável é liberado.
    if (script && !strict && !cspAllows(script.list, js, self)) missing.push(`${script.name} não inclui ${new URL(js).origin} (JS do remote)`)
    if (connect && manifestUrl.endsWith('.json') && !cspAllows(connect.list, manifestUrl, self))
      missing.push(`${connect.name} não inclui ${new URL(manifestUrl).origin} (o manifesto é baixado com fetch)`)
    if (connect && m.integrity && !cspAllows(connect.list, js, self)) missing.push(`${connect.name} não inclui ${new URL(js).origin} (o JS com integrity é conferido com fetch)`)
    if (missing.length) {
      out.push(error(`CSP (${p.source}) bloqueia o remote`, missing.join('; ') + '.', `acrescente ${new URL(js).origin} a script-src e connect-src.`))
      continue
    }
    out.push(ok(`CSP (${p.source}) libera o manifesto e o JS`))
    if (m.integrity && script && !strict && !script.list.includes('blob:'))
      out.push(
        warn(
          `CSP (${p.source}): ${script.name} sem blob:`,
          'navegadores que não conferem o hash de cada módulo executam o JS verificado a partir de uma URL blob:, e aí o remote não roda.',
          `acrescente blob: a ${script.name}.`,
        ),
      )
    const style = sources(p, 'style-src-elem', 'style-src')
    const blocked = style ? css.filter((u) => !cspAllows(style.list, u, self)) : []
    if (blocked.length)
      out.push(warn(`CSP (${p.source}): ${style!.name} não inclui ${new URL(blocked[0]).origin}`, 'o CSS do remote não carrega fora do Shadow DOM.', `acrescente ${new URL(blocked[0]).origin} a ${style!.name}.`))
  }
  return out
}

// ---------- JS ----------

/** O arquivo exporta `mount` (direto ou no `default`)? Conferência pelo texto, sem executar. */
export function exportsMount(code: string): 'mount' | 'default' | 'missing' {
  if (/export\s+(async\s+)?function\s*\*?\s*mount\b|export\s+(const|let|var)\s+mount\b|export\s*\{[^}]*\b(as\s+)?mount\s*[,}]/.test(code)) return 'mount'
  if (/export\s+default\b|export\s*\{[^}]*\bas\s+default\b/.test(code) && /\bmount\b/.test(code)) return 'default'
  return 'missing'
}

/** Confere `bytes` contra um `integrity` SRI: só o algoritmo mais forte presente decide, como no navegador. */
export function matchesIntegrity(bytes: Uint8Array, integrity: string): boolean | undefined {
  const hashes = integrity.split(/\s+/).map((t) => /^sha(256|384|512)-([\w+/=-]+)/.exec(t)).filter((m): m is RegExpExecArray => !!m)
  if (!hashes.length) return undefined
  const bits = Math.max(...hashes.map((m) => +m[1]))
  const clean = (b: string) => b.replace(/-/g, '+').replace(/_/g, '/').replace(/=/g, '')
  const actual = clean(createHash(`sha${bits}`).update(bytes).digest('base64'))
  return hashes.some((m) => +m[1] === bits && clean(m[2]) === actual)
}

/** Frameworks que o JS leva junto, pelas marcas que sobrevivem à minificação. */
const FRAMEWORKS: Record<string, RegExp> = {
  react: /__(SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED|CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE)/,
  vue: /__vue_app__/,
}

/**
 * Versão instalada de `pkg` no projeto host, se houver: o `node_modules` de
 * `cwd` ou de uma pasta acima (monorepo). Não usa o NODE_PATH, que o
 * `pnpm exec` aponta para as dependências de outro projeto.
 */
function installed(cwd: string, pkg: string): string | undefined {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', pkg, 'package.json')
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).version
    if (dir === dirname(dir)) return
  }
}

// ---------- remote ----------

interface Ctx {
  f: typeof fetch
  cwd: string
  origin: string
  known: boolean
  self?: string
  contract?: string
  maxKb?: number
  timeout: number
  policies: Policy[]
  deps: Record<string, string | undefined>
}

/** O que o doctor guarda de cada remote para as conferências entre remotes. */
type Seen = { name: string; manifest?: RemoteManifest }

async function checkRemote(name: string, e: RemoteJson, ctx: Ctx, seen: Seen): Promise<Check[]> {
  const out: Check[] = []
  const isJson = new URL(e.url).pathname.endsWith('.json')
  let m: RemoteManifest
  if (isJson) {
    const { res, bytes, failure } = await get(ctx.f, e.url, ctx.origin, ctx.timeout)
    if (!res) return [error(`manifesto: não foi possível baixar (${failure})`, `${e.url} não respondeu.`, 'confira a URL e se o servidor está no ar.')]
    if (!res.ok) return [error(`manifesto: HTTP ${res.status}`, `${e.url} não existe ou não está publicado.`, 'confira a URL no remotes.json e se o deploy do remote publicou o vitral.json.')]
    const c = cors('manifesto', e.url, res, ctx.origin, ctx.known)
    if (c) out.push(c)
    const text = new TextDecoder().decode(bytes)
    try {
      m = JSON.parse(text)
    } catch {
      const html = /^\s*</.test(text)
      out.push(
        error(
          'manifesto inválido: não é JSON',
          html ? 'o servidor devolveu HTML no lugar do vitral.json (fallback de SPA ou página de erro).' : `${e.url} não tem um JSON válido.`,
          'abra a URL no navegador; publique o vitral.json gerado pelo build (dist/vitral.json).',
        ),
      )
      return out
    }
    if (typeof m?.entry !== 'string') {
      out.push(error('manifesto inválido: falta o campo entry', 'sem entry o host não sabe qual JS carregar (INVALID_MODULE).', 'gere o vitral.json com o plugin vitral/vite, ou escreva { "name", "entry" }.'))
      return out
    }
    out.push(ok(`manifesto válido: ${m.name ?? name}${m.version ? ` ${m.version}` : ''}`))
  } else {
    m = { name, entry: e.url }
    out.push(ok('sem manifesto: a URL é o próprio JS'))
  }
  seen.manifest = m
  const abs = (u: string) => new URL(u, e.url).href
  const js = abs(m.entry)
  if (new URL(js).origin !== new URL(e.url).origin)
    out.push(
      warn(
        `o entry está em ${new URL(js).origin}, outra origem que o manifesto`,
        'sem allowedOrigins, o host só aceita as origens das URLs registradas (ORIGIN_BLOCKED).',
        `inclua ${new URL(js).origin} em configure({ allowedOrigins }).`,
      ),
    )

  // JS
  const { res, bytes, failure } = await get(ctx.f, js, ctx.origin, ctx.timeout)
  if (!res) out.push(error(`JS: não foi possível baixar (${failure})`, `${js} não respondeu.`, 'confira o entry do manifesto e se o servidor está no ar.'))
  else if (!res.ok) out.push(error(`JS: HTTP ${res.status} em ${js}`, 'o manifesto aponta para um arquivo que não foi publicado (LOAD_FAILED).', 'publique a pasta dist inteira, não só o vitral.json.'))
  if (res?.ok && bytes) {
    const c = cors('JS', js, res, ctx.origin, ctx.known)
    if (c) out.push(c)
    const type = res.headers.get('content-type') ?? ''
    if (!/javascript|ecmascript/i.test(type))
      out.push(
        error(
          `JS servido como ${type || 'sem Content-Type'}`,
          'o navegador só executa módulo ES com Content-Type de JavaScript.',
          'sirva os .js com Content-Type: text/javascript.',
        ),
      )
    const code = new TextDecoder().decode(bytes)
    const exp = exportsMount(code)
    if (exp === 'missing')
      out.push(
        (m.exposes?.length ? warn : error)(
          'o JS não exporta mount (nem default com mount)',
          m.exposes?.length ? 'só as partes expostas podem ser usadas (loadModule).' : 'o host recusa o módulo (INVALID_MODULE).',
          'exporte com defineRemote() ou com um adaptador (reactRemote, vueRemote...): export default defineRemote({ mount }).',
        ),
      )
    else out.push(ok(exp === 'mount' ? 'exporta mount' : 'exporta default com mount'))

    // Integrity
    for (const [who, integrity] of [
      ['host (remotes.json)', e.integrity],
      ['manifesto', m.integrity],
    ] as const) {
      if (!integrity) continue
      const match = matchesIntegrity(bytes, integrity)
      if (match === undefined) out.push(error(`integrity do ${who} em formato inválido: ${integrity}`, 'o host recusa o remote (INTEGRITY).', 'use sha256-, sha384- ou sha512- seguido do hash em base64.'))
      else if (!match)
        out.push(
          error(
            `integrity do ${who} não confere com o JS publicado`,
            who === 'manifesto' ? 'o JS foi trocado sem gerar o vitral.json de novo, ou um cache serve uma versão antiga.' : 'o remote foi publicado de novo e o hash fixado no host ficou velho.',
            who === 'manifesto' ? 'publique o JS e o vitral.json do mesmo build; limpe o cache do CDN.' : 'atualize o integrity no remotes.json com o do vitral.json novo.',
          ),
        )
      else out.push(ok(`integrity do ${who} confere`))
    }
    if (!e.integrity && !m.integrity) out.push(warn('sem integrity: o JS roda sem conferência', undefined, 'gere o manifesto com o plugin vitral/vite ou fixe integrity no host.'))

    // Tamanho
    const gz = gzipSync(bytes).length
    const size = `tamanho do JS: ${kb(bytes.length)} (${kb(gz)} com gzip)`
    if (ctx.maxKb !== undefined && gz > ctx.maxKb * 1024)
      out.push(error(size, `passa do limite de ${ctx.maxKb} kB.`, 'veja o que entrou no bundle (vite build --mode production com rollup-plugin-visualizer) e use dedupe para o framework.'))
    else if (ctx.maxKb === undefined && gz > WARN_KB * 1024) out.push(warn(size, `acima de ${WARN_KB} kB com gzip, o remote atrasa a página.`, 'confira o que entrou no bundle; use dedupe para o framework; passe --max-kb para tornar isto um erro.'))
    else out.push(ok(size))

    // Framework duplicado
    const deduped = new Set([...(m.dedupe ?? []).map((d) => d.name), ...Object.keys(m.contract?.peers ?? {})])
    for (const [fw, mark] of Object.entries(FRAMEWORKS)) {
      if (deduped.has(fw) || !ctx.deps[fw] || !mark.test(code)) continue
      out.push(
        warn(
          `o remote leva o próprio ${fw} e o host também tem ${fw} ${ctx.deps[fw]}`,
          'são duas cópias na página: mais download, e estado ou contexto de uma cópia não é visto pela outra.',
          `no remote: vitral({ dedupe: ['${fw}'] }).`,
        ),
      )
    }
  }

  // Arquivos com hash (CSS e build dividido)
  const files = Object.entries(m.files ?? {}).filter(([f]) => abs(f) !== js)
  const bad: string[] = []
  for (const [file, integrity] of files) {
    const got = await get(ctx.f, abs(file), ctx.origin, ctx.timeout)
    if (!got.res?.ok) bad.push(`${file} (${got.failure ?? `HTTP ${got.res!.status}`})`)
    else if (!matchesIntegrity(got.bytes!, integrity)) bad.push(`${file} (hash não confere)`)
    else if (/\.js$/.test(file)) {
      const c = cors(`arquivo ${file}`, abs(file), got.res, ctx.origin, ctx.known)
      if (c?.status !== 'ok' && c) out.push(c)
    }
  }
  if (bad.length)
    out.push(error(`arquivos do manifesto com problema: ${bad.join(', ')}`, 'o host não carrega o CSS ou o build dividido (INTEGRITY ou LOAD_FAILED).', 'publique todos os arquivos do mesmo build junto com o vitral.json.'))
  else if (files.length) out.push(ok(`${files.length} arquivo(s) do manifesto conferem com o hash`))

  // Contrato
  const range = e.contract ?? ctx.contract
  if (m.contract?.version && range) {
    if (satisfies(m.contract.version, range)) out.push(ok(`contrato ${m.contract.version} na faixa ${range} do host`))
    else
      out.push(
        error(
          `contrato incompatível: o host aceita ${range}, o remote publica ${m.contract.version}`,
          'o host recusa o remote antes de executar (CONTRACT_MISMATCH).',
          'publique uma versão do remote compatível, ou atualize o host para aceitar a nova versão do contrato.',
        ),
      )
  } else if (m.contract?.version) out.push(ok(`contrato ${m.contract.version} (o host não declarou faixa; passe --contract para conferir)`))
  else if (range && isJson) out.push(warn(`o host aceita contrato ${range}, mas o manifesto não declara versão`, 'nada é conferido para este remote.', "no remote: vitral({ contract: { version: '…' } })."))
  for (const [dep, want] of Object.entries(m.contract?.peers ?? {})) {
    const have = ctx.deps[dep]
    if (!have) continue
    if (satisfies(have, want)) out.push(ok(`${dep} ${have} do host serve para o remote (${want})`))
    else
      out.push(
        (range ? error : warn)(
          `${dep}: o remote espera ${want}, o host tem ${have}`,
          range
            ? 'com contrato ligado e o host oferecendo essa versão, o remote não monta (CONTRACT_MISMATCH).'
            : 'o remote baixa a própria cópia: duas cópias na página.',
          `alinhe ${dep} nos dois projetos.`,
        ),
      )
  }

  if (ctx.policies.length) out.push(...cspChecks(ctx.policies, ctx.self, m, e.url, js, [...(m.css ?? [])].map(abs)))
  return out
}

/** Grupos de `dedupe` cujas faixas nenhuma versão disponível satisfaz ao mesmo tempo. */
function divergent(seen: Seen[], deps: Record<string, string | undefined>): Check[] {
  const groups = new Map<string, { who: string; range: string; version: string }[]>()
  for (const s of seen) for (const d of s.manifest?.dedupe ?? []) groups.set(d.name, [...(groups.get(d.name) ?? []), { who: s.name, range: d.range, version: d.version }])
  const out: Check[] = []
  for (const [dep, list] of groups) {
    const candidates = [deps[dep], ...list.map((l) => l.version)].filter((v): v is string => !!v)
    if (list.length < 2 || candidates.some((v) => list.every((l) => satisfies(v, l.range)))) continue
    out.push(
      warn(
        `${dep} em versões divergentes: ${list.map((l) => `${l.who} ${l.range}`).join(', ')}`,
        `nenhuma versão serve para todos os remotes, então a página baixa mais de uma cópia de ${dep}.`,
        `alinhe ${dep} nos remotes (mesmo major).`,
      ),
    )
  }
  return out
}

/**
 * Lê os remotes: pares, arquivo local ou URL (de um `remotes.json` ou de um
 * `vitral.json`). Como no host, URL relativa de um `remotes.json` publicado
 * vale a partir dele; a de um arquivo local, a partir da página (`host`).
 */
async function remotesOf(o: DoctorOptions, f: typeof fetch, cwd: string, timeout: number): Promise<Record<string, RemoteJson>> {
  const args = o.args ?? []
  const url = args.find((a) => /^https?:\/\//.test(a) && !a.includes('='))
  if (!url) return readEntries(cwd, args, o.base ?? o.host)
  const res = await f(url, { signal: AbortSignal.timeout(timeout) }).catch(() => undefined)
  const data = res?.ok ? await res.json().catch(() => undefined) : undefined
  if (!data || typeof data !== 'object') throw new Error(`[vitral] não foi possível ler ${url}.`)
  if (typeof data.entry === 'string') return { [data.name ?? url]: { url } }
  return entriesOf(data, o.base ?? url)
}

/** Roda todas as conferências. */
export async function doctor(options: DoctorOptions = {}): Promise<DoctorReport> {
  ;({ satisfies } = await import('../core/dedupe'))
  const cwd = options.cwd ?? process.cwd()
  const f = options.fetch ?? fetch
  const timeout = options.timeout ?? 15000
  const remotes = await remotesOf(options, f, cwd, timeout)
  const known = !!(options.origin ?? options.host)
  const origin = known ? new URL((options.origin ?? options.host)!).origin : ANY_ORIGIN
  const host: Check[] = []
  const policies = await hostPolicies(f, cwd, options.host, timeout, host)
  const deps = Object.fromEntries(Object.keys(FRAMEWORKS).map((d) => [d, installed(cwd, d)]))
  const ctx: Ctx = { f, cwd, origin, known, self: known ? origin : undefined, contract: options.contract, maxKb: options.maxKb, timeout, policies, deps }
  if (!known) host.push(warn('origem do host desconhecida: o CORS é conferido com uma origem qualquer', undefined, 'passe --host url (ou --origin) para conferir com a origem certa.'))
  const seen: Seen[] = []
  const list = await Promise.all(
    Object.entries(remotes).map(async ([name, e]) => {
      const s: Seen = { name }
      seen.push(s)
      return { name, url: e.url, checks: await checkRemote(name, e, ctx, s) }
    }),
  )
  host.push(...divergent(seen, deps))
  const all = [...host, ...list.flatMap((r) => r.checks)]
  const errors = all.filter((c) => c.status === 'error').length
  return { ok: !errors, errors, warnings: all.filter((c) => c.status === 'warn').length, host, remotes: list }
}

const MARK: Record<Status, string> = { ok: '✓', warn: '!', error: '✗' }

/** Saída legível do relatório. */
export function format(r: DoctorReport): string {
  const lines: string[] = []
  const add = (c: Check) => {
    lines.push(`  ${MARK[c.status]} ${c.title}`)
    if (c.cause) lines.push(`      Causa: ${c.cause}`)
    if (c.fix) lines.push(`      O que fazer: ${c.fix}`)
  }
  lines.push('Host')
  r.host.forEach(add)
  for (const rem of r.remotes) {
    lines.push('', `${rem.name} (${rem.url})`)
    rem.checks.forEach(add)
  }
  lines.push('', r.errors || r.warnings ? `${r.errors} erro(s), ${r.warnings} aviso(s).` : 'Tudo certo.')
  return lines.join('\n')
}

/**
 * Linha de comando: `vitral doctor [remotes] [--host url] [--origin url]
 * [--base url] [--contract faixa] [--max-kb n] [--json]`. Devolve o código
 * de saída: 1 se alguma conferência falhou.
 */
export async function doctorCli(argv: string[], options: Pick<DoctorOptions, 'cwd' | 'fetch'> = {}, log: (msg: string) => void = console.log): Promise<number> {
  const args = [...argv]
  const json = args.includes('--json')
  const maxKb = flag(args, '--max-kb')
  const r = await doctor({
    ...options,
    base: flag(args, '--base'),
    host: flag(args, '--host'),
    origin: flag(args, '--origin'),
    contract: flag(args, '--contract'),
    maxKb: maxKb === undefined ? undefined : Number(maxKb),
    args: args.filter((a) => a !== '--json'),
  })
  log(json ? JSON.stringify(r, null, 2) : format(r))
  return r.ok ? 0 : 1
}
