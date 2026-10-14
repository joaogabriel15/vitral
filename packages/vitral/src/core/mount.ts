import { injectCss } from './css'
import { RemoteError } from './errors'
import { scopedEvents } from './events'
import { splitName } from './expose'
import { load } from './loader'
import { navigate } from './navigate'
import { protocol } from './state'
import { refreshable, track } from './updates'
import type { Isolation, MountedRemote, Props, RemoteContext } from './types'

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export interface MountOptions {
  isolate?: Isolation
  /** Chamado quando o remote quebra depois de montado (erro de render, handler etc.). */
  onError?: (error: RemoteError) => void
}

/**
 * Monta um remote dentro de `target`. Devolve um handle com `update` e
 * `unmount` que funciona igual para qualquer framework. Com `refresh(nome)`,
 * o mesmo handle passa a apontar para a versão nova.
 */
export async function mountRemote<P extends Props = Props>(
  target: HTMLElement,
  name: string,
  props: P,
  options: MountOptions = {},
): Promise<MountedRemote<P>> {
  return refreshable(await mountOnce(target, name, props, options), name, props, (latest) => mountOnce(target, name, latest, options))
}

type Mounter = <P extends Props>(target: HTMLElement, name: string, props: P, options: MountOptions) => Promise<MountedRemote<P>>
let frames: Mounter | undefined

/** Liga `isolate: 'iframe'` (chamado por `enableIframe()`, de `vitral/iframe`). */
export function setFrameMounter(mounter: Mounter): void {
  frames = mounter
}

async function mountOnce<P extends Props>(target: HTMLElement, name: string, props: P, options: MountOptions): Promise<MountedRemote<P>> {
  const p = protocol()
  await p.pending()
  // Decide antes de baixar: no modo iframe o JS do remote nunca roda na página.
  if ((options.isolate ?? p.entry(splitName(name)[0])?.isolate ?? p.settings().isolate) === 'iframe') {
    if (!frames) throw new RemoteError('MOUNT_FAILED', name, 'isolate="iframe" precisa de enableIframe(), de vitral/iframe')
    return frames(target, name, props, options)
  }
  const { module: mod, ...resolved } = await load(name)
  track(name, resolved.entry)
  const isolate = options.isolate ?? resolved.isolate ?? protocol().settings().isolate

  // Cada montagem ganha seu próprio elemento. Assim duas montagens no mesmo
  // alvo (ex.: StrictMode do React) nunca disputam o mesmo DOM.
  let shadowRoot: ShadowRoot | null = null
  const el = document.createElement('div')
  el.setAttribute('data-vitral-root', name)
  if (resolved.scope) el.setAttribute('data-vitral-scope', resolved.scope)
  el.style.display = 'contents'
  if (isolate === 'shadow') {
    shadowRoot = target.shadowRoot ?? target.attachShadow({ mode: 'open' })
    shadowRoot.appendChild(el)
  } else {
    target.appendChild(el)
  }
  await injectCss(resolved.css, shadowRoot)

  const scoped = scopedEvents()
  const ctx: RemoteContext = {
    name,
    baseUrl: new URL('.', resolved.entry).href,
    events: scoped.bus,
    shadowRoot,
    reportError(e) {
      const err = e instanceof RemoteError ? e : new RemoteError('RENDER_FAILED', name, String((e as Error)?.message ?? e), e)
      if (options.onError) options.onError(err)
      else console.error(err)
    },
    navigate,
    protocol: protocol().protocol,
  }
  let mounted: MountedRemote
  try {
    mounted = await mod.mount(el, props, ctx)
  } catch (e) {
    scoped.dispose()
    el.remove()
    throw new RemoteError('MOUNT_FAILED', name, 'erro ao montar', e)
  }
  let alive = true
  return {
    update(next: P) {
      if (alive) mounted.update?.(next)
    },
    unmount() {
      if (!alive) return
      alive = false
      try {
        mounted.unmount()
      } finally {
        scoped.dispose()
        el.remove()
      }
    },
  }
}
