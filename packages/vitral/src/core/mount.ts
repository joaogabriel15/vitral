import { injectCss } from './css'
import { RemoteError } from './errors'
import { scopedEvents } from './events'
import { ctxHooks } from './hooks'
import { load } from './loader'
import { navigate } from './navigate'
import { protocol } from './state'
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
 * `unmount` que funciona igual para qualquer framework.
 */
export async function mountRemote<P extends Props = Props>(
  target: HTMLElement,
  name: string,
  props: P,
  options: MountOptions = {},
): Promise<MountedRemote<P>> {
  const { module: mod, ...resolved } = await load(name)
  const isolate = options.isolate ?? resolved.isolate ?? protocol().settings().isolate
  const label = resolved.name ?? name

  // Cada montagem ganha seu próprio elemento. Assim duas montagens no mesmo
  // alvo (ex.: StrictMode do React) nunca disputam o mesmo DOM.
  let shadowRoot: ShadowRoot | null = null
  const el = document.createElement('div')
  el.setAttribute('data-vitral-root', label)
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
    name: label,
    baseUrl: new URL('.', resolved.entry).href,
    events: scoped.bus,
    shadowRoot,
    reportError(e) {
      const err = e instanceof RemoteError ? e : new RemoteError('RENDER_FAILED', label, String((e as Error)?.message ?? e), e)
      if (options.onError) options.onError(err)
      else console.error(err)
    },
    navigate,
    protocol: protocol().protocol,
  }
  if (ctxHooks.shared) ctx.shared = ctxHooks.shared(name, scoped.track)
  let mounted: MountedRemote
  try {
    mounted = await mod.mount(el, props, ctx)
  } catch (e) {
    scoped.dispose()
    el.remove()
    throw new RemoteError('MOUNT_FAILED', label, 'erro ao montar', e)
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
