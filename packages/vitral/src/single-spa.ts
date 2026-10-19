/**
 * App do single-spa como remote do vitral, sem reescrever o app:
 *
 *   // src/vitral-remote.js
 *   import { singleSpaRemote } from 'vitral/single-spa'
 *   import * as lifecycles from './main' // exporta bootstrap, mount e unmount
 *
 *   export default singleSpaRemote(lifecycles)
 *
 * Funciona com os lifecycles de `single-spa-react`, `single-spa-vue`,
 * `single-spa-angular` etc. e com lifecycles escritos à mão. Os lifecycles
 * recebem as props do host mais `name` e `domElement` (o elemento do remote).
 */
import type { MountedRemote, Props, RemoteModule } from './core/types'

/** Um lifecycle do single-spa: uma função ou uma lista delas, em sequência. */
export type SingleSpaLifecycle = ((props: any) => unknown) | ((props: any) => unknown)[]

/** O que um app ou parcel do single-spa exporta. */
export interface SingleSpaLifecycles {
  bootstrap?: SingleSpaLifecycle
  mount: SingleSpaLifecycle
  unmount: SingleSpaLifecycle
  update?: SingleSpaLifecycle
}

async function run(fns: SingleSpaLifecycle | undefined, props: Props): Promise<void> {
  for (const fn of [fns ?? []].flat()) await fn(props)
}

/**
 * Embrulha os lifecycles de um app do single-spa no contrato `mount`.
 *
 * - `bootstrap` roda uma vez, antes do primeiro `mount`.
 * - Os lifecycles nunca se sobrepõem: um `mount` espera o `unmount` anterior.
 * - `update(props)` chama o `update` do app (parcels); sem ele, o app é
 *   desmontado e montado de novo com as props novas.
 * - Duas instâncias ao mesmo tempo recebem `name` diferentes (`conta`, `conta-2`).
 */
export function singleSpaRemote<P extends Props = Props>(lifecycles: SingleSpaLifecycles | { default: SingleSpaLifecycles }): RemoteModule<P> {
  const l: SingleSpaLifecycles = 'mount' in lifecycles ? lifecycles : lifecycles.default
  if (typeof l?.mount == 'undefined' || typeof l.unmount == 'undefined') throw new Error('[vitral] singleSpaRemote: faltam os lifecycles mount e unmount')
  let booted: Promise<void> | undefined
  let queue: Promise<unknown> = Promise.resolve()
  const used = new Set<string>()
  // Fila única: o single-spa nunca chama dois lifecycles do mesmo app ao mesmo tempo.
  const step = (fn: () => Promise<void>) => (queue = queue.then(fn, fn))
  const boot = (props: Props) =>
    (booted ??= run(l.bootstrap, props).catch((e) => {
      booted = undefined
      throw e
    }))
  return {
    async mount(el, props, ctx): Promise<MountedRemote<P>> {
      let name = ctx.name
      for (let i = 2; used.has(name); i++) name = `${ctx.name}-${i}`
      used.add(name)
      let current: Props = { ...props, name, domElement: el }
      try {
        await step(async () => {
          await boot(current)
          await run(l.mount, current)
        })
      } catch (e) {
        used.delete(name)
        throw e
      }
      const report = (e: unknown) => ctx.reportError(e)
      return {
        update(next) {
          const before = current
          current = { ...next, name, domElement: el }
          const job = l.update
            ? step(() => run(l.update, current))
            : step(async () => {
                await run(l.unmount, before)
                await run(l.mount, current)
              })
          job.catch(report)
        },
        unmount() {
          // A fila garante que um mount com o mesmo name só roda depois deste unmount.
          used.delete(name)
          step(() => run(l.unmount, current)).catch(report)
        },
      }
    },
  }
}
