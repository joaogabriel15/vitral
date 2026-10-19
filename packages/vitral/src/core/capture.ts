/**
 * Atribuição de erros sem tratamento (`configure({ captureGlobalErrors: true })`).
 *
 * Um erro que escapa do código de um remote chega em `error` ou
 * `unhandledrejection` da janela, sem dizer de quem é. O dono é o remote
 * montado cujo diretório (o do arquivo JS dele) contém o arquivo do topo da
 * pilha. Fica de fora, para não atribuir errado:
 * - diretório que também tem scripts do host (`<script src>` e
 *   `modulepreload` da página), como quando host e remote saem da mesma pasta;
 * - pilha sem URL, ou com `blob:` (o caminho de SRI que executa por blob);
 * - erro que o remote já entregou com `ctx.reportError`.
 */
import { isRemoteError, mounted, RemoteError, report, reported } from './errors'
import { protocol } from './state'

let on = false

/** Liga a escuta (uma vez só). Desligar é `configure({ captureGlobalErrors: false })`. */
export function capture(): void {
  if (on || typeof addEventListener == 'undefined') return
  on = true
  addEventListener('error', (e) => attribute(e.error, e.filename))
  addEventListener('unhandledrejection', (e) => attribute(e.reason))
}

/** Remote dono de `error`, ou `undefined` quando não dá para saber com certeza. */
export function owner(error: unknown, file?: string): string | undefined {
  const url = file || String((error as Error)?.stack ?? '').match(/(?:https?|file):\/\/[^\s)'"]+/)?.[0]
  if (!url) return
  const host = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel=modulepreload]')].map(
    (el) => (el as HTMLScriptElement).src || (el as HTMLLinkElement).href,
  )
  let best: string | undefined
  let size = 0
  for (const [name, { entry }] of mounted) {
    const dir = new URL('.', entry).href
    if (dir.length > size && url.startsWith(dir) && !host.some((u) => u.startsWith(dir))) (best = name), (size = dir.length)
  }
  return best
}

function attribute(error: unknown, file?: string) {
  if (!protocol().settings().captureGlobalErrors || isRemoteError(error) || (error instanceof Object && reported.has(error))) return
  const name = owner(error, file)
  if (name) report(new RemoteError('RENDER_FAILED', name, String((error as Error)?.message ?? error), error), mounted.get(name))
}
