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
import { addLink } from './util'

export interface SplitBuild {
  /** Entrada do build dividido. */
  entry: string
  /** Chunks que a entrada importa logo. */
  chunks: string[]
  /** Hash SRI de cada arquivo, por URL absoluta. */
  sri: Record<string, string>
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
export async function verified(build: SplitBuild): Promise<string | undefined> {
  const { entry, chunks, sri } = build
  if (![entry, ...chunks].every((u) => STRICT.test(sri[u] ?? ''))) return
  if (maps !== false && (maps = await addMap(sri))) {
    for (const u of chunks) fetch(u).catch(() => {})
    return entry
  }
  if (await (preloads ??= checkPreloads())) {
    await Promise.all([...chunks, entry].map((u) => preload(u, sri[u])))
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

function preload(href: string, integrity: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const link = addLink('modulepreload', href, { integrity })
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
