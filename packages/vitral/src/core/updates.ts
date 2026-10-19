/**
 * Atualização sem reload: uma SPA aberta por horas vê o deploy novo de um remote.
 *
 *   watchUpdates()
 *   events.on('vitral:update-available', ({ name }) => refresh(name))
 *
 * `refresh` baixa a versão nova e troca cada montagem daquele remote pela nova,
 * com as props atuais. Se a versão nova falhar, a antiga continua na tela.
 */
import { events } from './events'
import { loadFile, resolveEntry } from './loader'
import { protocol } from './state'
import type { MountedRemote, Props, RemoteEntry } from './types'

/** URL do JS montado (ou já anunciado), por nome montado (`carrinho` ou `carrinho/Mini`). */
const versions = new Map<string, string>()
/** Montagens vivas por nome: só esses remotes são revalidados. */
const live = new Map<string, number>()

/** Marca uma montagem de `name`. Devolve a função que desmarca; o unmount chama uma vez só. */
export function track(name: string, entry: string): () => void {
  versions.set(name, entry)
  live.set(name, (live.get(name) ?? 0) + 1)
  return () => {
    const n = live.get(name)! - 1
    if (n) live.set(name, n)
    else live.delete(name), versions.delete(name)
  }
}

/**
 * Troca as montagens de `name` (e das partes, `name/…`) pela versão que o
 * manifesto aponta agora, sem recarregar a página. Rejeita se a versão nova
 * não carregar; nesse caso nada muda na tela.
 */
export async function refresh(name: string): Promise<void> {
  const p = protocol()
  await p.pending()
  const entry = p.entry(name)
  // Registrar de novo descarta o módulo em cache em todas as cópias da lib.
  if (entry) p.register(name, entry)
  await loadFile(name)
  events.emit('vitral:refresh', name)
}

/** Handle que troca o remote montado quando chega `vitral:refresh` daquele nome. */
export function refreshable<P extends Props>(
  current: MountedRemote<P>,
  name: string,
  props: P,
  remount: (props: P) => Promise<MountedRemote<P>>,
): MountedRemote<P> {
  const off = events.on<string>('vitral:refresh', (n) => {
    if (n === name || name.startsWith(n + '/')) {
      remount(props).then((next) => {
        const old = current
        // Desmontado enquanto a versão nova baixava: descarta a nova.
        if (old.unmount === noop) return next.unmount()
        current = next
        old.unmount()
      }, console.error)
    }
  })
  return {
    update(next) {
      props = next
      current.update?.(next)
    },
    unmount() {
      off()
      current.unmount()
      current = { unmount: noop }
    },
  }
}

const noop = () => {}

/**
 * Revalida os manifestos dos remotes montados agora (os desmontados ficam de
 * fora) e emite
 * `vitral:update-available` com `{ name, entry }` para cada deploy novo.
 * Devolve os nomes com versão nova. Falhas de rede são ignoradas.
 */
export async function checkUpdates(): Promise<string[]> {
  const p = protocol()
  const found: string[] = []
  // Partes do mesmo remote (`carrinho/Mini`) contam como o remote.
  const { splitName } = await import('./expose')
  const remotes = new Map<string, string>()
  for (const name of live.keys()) {
    const root = splitName(name)[0]
    const entry = versions.get(root) ?? versions.get(name)
    if (entry) remotes.set(root, entry)
  }
  for (const [name, entry] of remotes) versions.set(name, entry)
  await Promise.all(
    [...remotes].map(([name, current]) =>
      resolveEntry(name, p.entry(name) as RemoteEntry & { url: string }).then(({ entry }) => {
        if (entry !== current) {
          versions.set(name, entry)
          found.push(name)
          events.emit('vitral:update-available', { name, entry })
        }
      }, noop),
    ),
  )
  return found
}

/**
 * Revalida os manifestos a cada navegação (`popstate`, que `navigate()` também
 * dispara, e a Navigation API onde existe). Devolve a função que desliga.
 */
export function watchUpdates(): () => void {
  let busy: Promise<unknown> | null = null
  const run = () => (busy ??= checkUpdates().finally(() => (busy = null)))
  const nav = (globalThis as any).navigation as EventTarget | undefined
  addEventListener('popstate', run)
  nav?.addEventListener('navigatesuccess', run)
  return () => {
    removeEventListener('popstate', run)
    nav?.removeEventListener('navigatesuccess', run)
  }
}
