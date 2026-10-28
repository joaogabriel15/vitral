/**
 * SRI sem `blob:`: o navegador confere o hash de cada módulo, e o remote roda
 * da própria URL (cache de código, code splitting, source maps, CSP sem
 * `blob:`). Há três caminhos, escolhidos pelo comportamento do navegador:
 *
 * 1. Import map com `integrity`, adicionado na hora, com o hash de todo JS do
 *    build (entrada, chunks, `import()` e cópias de dedupe). Só onde import
 *    maps tardios são aceitos (Chrome 133+, Safari 18.4+): no primeiro mapa,
 *    dois módulos de teste mostram que o hash é conferido. Se o navegador
 *    recusa o mapa (evento `error`, ou em silêncio), ou a CSP o bloqueia, o
 *    caminho fica desligado. Os chunks são aquecidos com `fetch`, nunca com
 *    modulepreload (o WebKit ignora `integrity` nele).
 * 2. `<link rel="modulepreload" integrity>`, onde um teste com dois módulos
 *    `data:` mostra que o hash do preload é conferido. Os chunks entram antes
 *    da entrada, na mesma tarefa, e o `import()` só vem depois de todos.
 * 3. Bytes conferidos e executados via `blob:` (`loader.ts`), o caminho de
 *    sempre. Vale para os outros navegadores e para quem já falhou.
 */
import { verifyIntegrity } from './integrity'
import type { Protocol } from './state'
import { RemoteError } from './errors'
import { addLink, fetchBytes, withTimeout } from './util'

export interface SplitBuild {
  /** Entrada do build dividido. */
  entry: string
  /** Chunks que a entrada importa logo. */
  chunks: string[]
  /** Chunks que o remote só baixa depois (`import()` das rotas). */
  lazy?: string[]
  /** Hash SRI de cada arquivo, por URL absoluta. */
  sri: Record<string, string>
  priority?: RequestPriority
  /** Módulos de teste servidos com o remote (manifesto `probe`), com URLs absolutas. */
  probe?: [string, string]
  /** Cópias próprias das dependências de `dedupe`, com URLs absolutas. */
  dedupe?: { name: string; range: string; version: string; file: string; chunks?: string[] }[]
}

/** O que o loader sabe de um remote com integrity. */
export interface Verifiable {
  /** Arquivo único. */
  entry: string
  integrity: string
  split?: SplitBuild
  priority?: RequestPriority
}

/** Arquivos únicos que já falharam: o mapa de módulos pode guardar o erro, então só `blob:`. */
const failed = new Set<string>()

/** Importa o remote pelo melhor caminho que confere o hash. */
export async function importVerified(name: string, r: Verifiable, run: (url: string) => Promise<any>, timeout: number): Promise<any> {
  const { entry, integrity, priority } = r
  if (!failed.has(entry)) {
    try {
      // Caminhos 1 e 2: o navegador confere o hash e o JS roda da própria URL.
      // O timeout cobre também os modulepreload, que esperam o download.
      const go = async () => {
        const url = await verified(r.split ?? { entry, chunks: [], sri: { [entry]: integrity }, priority }, run)
        return url && { ns: await run(url) }
      }
      const done = await withTimeout(timeout, name, go())
      if (done) return done.ns
    } catch (e) {
      // O mapa de módulos guarda a URL que travou: as próximas tentativas
      // vão pelo caminho 3. Esta já gastou o tempo dela e termina em TIMEOUT.
      failed.add(entry)
      if (e instanceof RemoteError && e.code === 'TIMEOUT') throw e
    }
  }
  // Caminho 3: executa exatamente os bytes verificados.
  // Depois de uma falha, sem esperar pela requisição anterior que pode
  // continuar presa no cache HTTP do navegador.
  const bytes = await fetchBytes(entry, timeout, name, failed.has(entry) ? { priority, cache: 'reload' } : { priority })
  await verifyIntegrity(name, bytes, integrity)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }))
  try {
    return await run(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Só hashes no formato que todo navegador entende. Um token que o navegador
// não reconhecesse seria tratado como "sem integrity", e o módulo rodaria sem
// conferência; nesse caso o caminho 3 confere os bytes.
const STRICT = /^(sha(256|384|512)-[A-Za-z0-9+/]+={0,2}( +|$))+$/

const PROBE = 'data:text/javascript,export{}'
const PROBE_SRI = 'sha256-d3bjIZdvLjBurwdLwkSVOnEBPFFly+T1SR9r3VVHBGg='

let maps: boolean | undefined
/** URLs que já estão num import map: repetir a URL em outro mapa gera aviso no console. */
const mapped = new Set<string>()
/** O primeiro mapa, com os módulos de teste: os remotes que chegam junto esperam por ele. */
let probing: Promise<boolean> | undefined
let preloads: Promise<boolean> | undefined

// O módulo de teste com hash errado deixa uma linha de erro no console. O
// resultado fica guardado por navegador (user agent), então a linha aparece
// uma vez, não a cada página.
const KEY = 'vitral:sri-map'

/** Adiciona o mapa do build; o primeiro confere antes que o navegador aplica o hash. */
async function useMap(sri: Record<string, string>, own?: [string, string]): Promise<boolean> {
  if (probing) return (await probing) && addMap(sri, false)
  let seen = false
  try {
    seen = localStorage[KEY] === navigator.userAgent
  } catch {}
  const ok = await (probing = addMap(sri, !seen, own))
  if (ok && !seen)
    try {
      localStorage[KEY] = navigator.userAgent
    } catch {}
  return ok
}

/** Próxima tarefa, sem o atraso dos timers em abas em segundo plano. */
const tick = () => new Promise<void>((resolve) => {
  const c = new MessageChannel()
  c.port1.onmessage = () => resolve()
  c.port2.postMessage(0)
})

/**
 * Prepara o build para `import()` com o hash conferido pelo navegador e
 * devolve a URL a importar, ou `undefined` para usar o caminho 3.
 */
export async function verified(build: SplitBuild, run?: (url: string) => Promise<any>): Promise<string | undefined> {
  const { entry, chunks, sri, priority = 'auto', dedupe = [] } = build
  const own = dedupe.flatMap((d) => [...(d.chunks ?? []), d.file])
  if (![entry, ...chunks, ...own].every((u) => STRICT.test(sri[u] ?? ''))) return
  // O protocolo já existe aqui (o loader passou por ele).
  const p = (globalThis as any)[Symbol.for('vitral')] as Protocol
  // Cópia própria de cada dependência de dedupe: só baixa se ninguém na
  // página oferece uma versão na faixa, e já fica oferecida aos próximos
  // remotes, junto com a entrada. O código do dedupe só vem se houver.
  const share = async (pre?: boolean) => {
    if (!run || !dedupe.length) return
    const { shared } = await import('./dedupe')
    for (const d of dedupe)
      shared(p)(d.name, d.range, {
        version: d.version,
        url: d.file,
        load: async () => {
          if (pre) await Promise.all([...(d.chunks ?? []), d.file].map((u) => preload(u, sri[u], priority)))
          return (await run!(d.file)).default
        },
      })
  }
  // Os módulos de teste do remote decidem se o navegador confere o hash: só valem se a rede não pode trocá-los
  // (mesma origem da página, ou data:). Um CDN de outra origem podia responder 404 ao módulo errado e passar no teste.
  const probes = build.probe?.every((u) => u.startsWith('data:') || new URL(u, location.href).origin === location.origin) ? build.probe : undefined
  if (maps !== false && (maps = await useMap(sri, probes))) {
    await share()
    for (const u of chunks) fetch(u, { priority }).catch(() => {})
    return entry
  }
  if (await (preloads ??= checkPreloads(probes))) {
    // Para os import() do remote (helper do plugin) conferirem também.
    p.sri = { ...p.sri, ...sri }
    await share(true)
    await Promise.all([...chunks, entry].map((u) => preload(u, sri[u], priority)))
    return entry
  }
}

/**
 * Mapa `{ integrity }` novo, só com o JS (CSS não passa por import map).
 * Resolve `false` se o navegador ou a CSP o recusar. Com `probe`, confere
 * também que o hash do mapa vale: um navegador que recusa em silêncio, ou
 * aceita sem conferir, rodaria o remote sem conferência.
 */
async function addMap(sri: Record<string, string>, probe: boolean, own?: [string, string]): Promise<boolean> {
  if (!HTMLScriptElement.supports?.('importmap')) return false
  const integrity: Record<string, string> = {}
  // Um mapa recusado desliga o caminho 1 de vez, então já marca aqui.
  for (const u in sri) if (!/\.css([?#]|$)/.test(u) && !mapped.has(u)) mapped.add(u), (integrity[u] = sri[u])
  // Dois módulos `blob:` (URLs novas, fora do mapa de módulos), os dois com o
  // hash do primeiro: o certo carrega e o errado tem de falhar.
  const urls = probe ? ['export{}', 'export{}//'].map((c) => URL.createObjectURL(new Blob([c], { type: 'text/javascript' }))) : []
  for (const u of urls) integrity[u] = PROBE_SRI
  let ok = true
  const fail = () => (ok = false)
  const load = (u: string) => import(/* @vite-ignore */ /* webpackIgnore: true */ u)
  try {
    await map(integrity, fail)
    if (ok && probe) {
      let r = await check(load, urls[0], urls[1])
      // CSP sem `blob:`: nem o módulo certo carrega. Testa com os do remote, servidos com ele.
      if (r === undefined && own) {
        await map({ [own[0]]: PROBE_SRI, [own[1]]: PROBE_SRI }, fail)
        r = ok && (await check(load, own[0], own[1]))
      }
      ok = !!r
    }
  } catch {
    ok = false
  }
  for (const u of urls) URL.revokeObjectURL(u)
  return ok
}

/** Adiciona um import map; `fail` se o navegador ou a CSP o recusar (o erro chega numa tarefa). */
async function map(integrity: Record<string, string>, fail: () => void): Promise<void> {
  const s = document.createElement('script')
  s.type = 'importmap'
  s.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''
  s.onerror = fail
  s.addEventListener('securitypolicyviolation', fail)
  s.textContent = JSON.stringify({ integrity })
  document.head.append(s)
  await tick()
  await tick()
}

function preload(href: string, integrity: string, fetchPriority: RequestPriority = 'auto'): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const link = addLink('modulepreload', href, { integrity, fetchPriority })
    link.onload = resolve
    link.onerror = reject
  })
}

/** O navegador confere o hash do modulepreload? */
async function checkPreloads(own?: [string, string]): Promise<boolean> {
  if (!document.createElement('link').relList.supports('modulepreload')) return false
  const load = (href: string) => preload(href, PROBE_SRI)
  const r = await check(load, PROBE, PROBE + '//')
  // CSP sem `data:`: os do remote, com URLs novas (as do import map já podem estar no mapa de módulos).
  return !!(r === undefined && own ? await check(load, ...(own.map((u) => u + (u.includes('?') ? '&' : '?') + 'preload') as [string, string])) : r)
}

/**
 * O módulo certo carrega e o errado falha? `undefined` se nem o certo
 * carrega (a CSP bloqueou). Sem resposta em 3s, na dúvida, não.
 */
function check(load: (url: string) => Promise<unknown>, good: string, bad: string): Promise<boolean | undefined> {
  return Promise.race([
    Promise.all([load(good).then(() => true, () => false), load(bad).then(() => false, () => true)]).then(([a, b]) => (a ? b : undefined)),
    new Promise<boolean>((resolve) => setTimeout(resolve, 3000, false)),
  ])
}
