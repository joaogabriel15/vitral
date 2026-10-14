/**
 * SRI sem `blob:`: o navegador confere o hash de cada módulo, e o remote roda
 * da própria URL (cache de código, code splitting, source maps, CSP sem
 * `blob:`). Há três caminhos, escolhidos pelo comportamento do navegador:
 *
 * 1. Import map com `integrity`, adicionado na hora. Só onde import maps
 *    tardios são aceitos: se o navegador recusa (evento `error`) ou a CSP
 *    bloqueia o mapa, o caminho fica desligado. Os chunks são aquecidos com
 *    `fetch`, nunca com modulepreload (o WebKit ignora `integrity` nele).
 * 2. `<link rel="modulepreload" integrity>`, onde um teste com dois módulos
 *    `data:` mostra que o hash do preload é conferido. Os chunks entram antes
 *    da entrada, na mesma tarefa, e o `import()` só vem depois de todos.
 * 3. Bytes conferidos e executados via `blob:` (`loader.ts`), o caminho de
 *    sempre. Vale para os outros navegadores e para quem já falhou.
 */
import { verifyIntegrity } from './integrity'
import type { Protocol } from './state'
import { addLink, fetchBytes } from './util'

export interface SplitBuild {
  /** Entrada do build dividido. */
  entry: string
  /** Chunks que a entrada importa logo. */
  chunks: string[]
  /** Hash SRI de cada arquivo, por URL absoluta. */
  sri: Record<string, string>
  priority?: RequestPriority
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
      const url = await verified(r.split ?? { entry, chunks: [], sri: { [entry]: integrity }, priority }, run)
      if (url) return await run(url)
    } catch {
      failed.add(entry)
    }
  }
  // Caminho 3: executa exatamente os bytes verificados.
  const bytes = await fetchBytes(entry, timeout, name, { priority })
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
let preloads: Promise<boolean> | undefined

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
    const { shared } = await import('./shared')
    for (const d of dedupe)
      shared(p)(d.name, d.range, {
        version: d.version,
        load: async () => {
          if (pre) await Promise.all([...(d.chunks ?? []), d.file].map((u) => preload(u, sri[u], priority)))
          return (await run!(d.file)).default
        },
      })
  }
  if (maps !== false && (maps = await addMap(sri))) {
    await share()
    for (const u of chunks) fetch(u, { priority }).catch(() => {})
    return entry
  }
  if (await (preloads ??= checkPreloads())) {
    // Para os import() do remote (helper do plugin) conferirem também.
    p.sri = { ...p.sri, ...sri }
    await share(true)
    await Promise.all([...chunks, entry].map((u) => preload(u, sri[u], priority)))
    return entry
  }
}

/** Mapa `{ integrity }` novo. Resolve `false` se o navegador ou a CSP o recusar. */
async function addMap(integrity: Record<string, string>): Promise<boolean> {
  let ok = true
  try {
    const s = document.createElement('script')
    s.type = 'importmap'
    s.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''
    s.onerror = () => (ok = false)
    s.addEventListener('securitypolicyviolation', () => (ok = false))
    s.textContent = JSON.stringify({ integrity })
    document.head.append(s)
  } catch {
    return false
  }
  // O erro de um mapa recusado chega numa tarefa.
  await tick()
  await tick()
  return ok
}

function preload(href: string, integrity: string, fetchPriority: RequestPriority = 'auto'): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const link = addLink('modulepreload', href, { integrity, fetchPriority })
    link.onload = resolve
    link.onerror = reject
  })
}

/** O navegador confere o hash do modulepreload? Um módulo certo carrega e um errado falha. */
function checkPreloads(): Promise<boolean> {
  if (!document.createElement('link').relList.supports('modulepreload')) return Promise.resolve(false)
  const run = (href: string, good: boolean) => preload(href, PROBE_SRI).then(() => good, () => !good)
  // Sem resposta em 3s, na dúvida, fica com o caminho 3.
  return Promise.race([
    Promise.all([run(PROBE, true), run(PROBE + '//', false)]).then(([a, b]) => a && b),
    new Promise<boolean>((resolve) => setTimeout(resolve, 3000, false)),
  ])
}
