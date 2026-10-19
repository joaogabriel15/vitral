import { injectStyles } from './css'
import { fail, isRemoteError, RemoteError, report } from './errors'
import { scopedEvents } from './events'
import { ctxHooks } from './hooks'
import { load } from './loader'
import { navigate } from './navigate'
import { protocol } from './state'
import { refreshable, track } from './updates'
import type { Isolation, MountedRemote, Props, RemoteContext, StyleOptions } from './types'
import { metric } from './util'

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export interface MountOptions {
  isolate?: Isolation
  /** `'high'` para o remote que aparece logo ao abrir a página: vira `fetchpriority` nos downloads. */
  priority?: RequestPriority
  /** Estilos do host no Shadow DOM (somados aos do `configure`). */
  styles?: StyleOptions
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
  if ((options.isolate ?? registered(name)?.isolate ?? p.settings().isolate) === 'iframe') {
    if (!frames) throw report(new RemoteError('MOUNT_FAILED', name, 'isolate="iframe" precisa de enableIframe(), de vitral/iframe'))
    return frames(target, name, props, options).catch(fail)
  }
  const { module: mod, ...resolved } = await load(name, options.isolate, options.priority)
  const untrack = track(name, resolved)
  const isolate = options.isolate ?? resolved.isolate ?? protocol().settings().isolate
  const label = resolved.name ?? name

  // Cada montagem ganha seu próprio elemento. Assim duas montagens no mesmo
  // alvo (ex.: StrictMode do React) nunca disputam o mesmo DOM.
  const make = (options?: ElementCreationOptions) => {
    const el = document.createElement('div', options)
    el.setAttribute('data-vitral-root', label)
    if (resolved.scope) el.setAttribute('data-vitral-scope', resolved.scope)
    el.style.display = 'contents'
    return el
  }
  let t = performance.now()
  // No Shadow DOM, `./shadow` cria o shadow root e o elemento com o registro
  // de custom elements do remote; `portal` fica dentro do shadow root.
  const [release, portal = document.body, shadowRoot = null, registry = customElements, el = target.appendChild(make())] = await injectStyles(
    resolved,
    isolate === 'shadow' && target,
    make,
    options.styles,
  )
  metric(name, 'css', t)
  t = performance.now()

  const scoped = scopedEvents()
  // Keep-alive avisa o remote com eventos no elemento raiz, que somem com ele.
  const on = (type: string) => (fn: () => void) => (el.addEventListener(type, fn), () => el.removeEventListener(type, fn))
  const ctx: RemoteContext = {
    name: label,
    baseUrl: new URL('.', resolved.entry).href,
    events: scoped.bus,
    shadowRoot,
    portalContainer: portal,
    customElements: registry,
    reportError(e) {
      const err = report(isRemoteError(e) ? e : new RemoteError('RENDER_FAILED', label, String((e as Error)?.message ?? e), e), resolved)
      if (options.onError) options.onError(err)
      else console.error(err)
    },
    navigate,
    protocol: protocol().protocol,
    onActivate: on('vitral:activate'),
    onDeactivate: on('vitral:deactivate'),
  }
  if (ctxHooks.shared) ctx.shared = ctxHooks.shared(name, scoped.track)
  let mounted: MountedRemote
  try {
    mounted = await mod.mount(el, props, ctx)
    metric(name, 'mount', t)
  } catch (e) {
    untrack()
    scoped.dispose()
    release()
    el.remove()
    throw report(new RemoteError('MOUNT_FAILED', label, 'erro ao montar', e), resolved)
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
        untrack()
        scoped.dispose()
        release()
        el.remove()
      }
    },
  }
}

/** Registro de `name` ou do remote de que ele é parte (`carrinho/Mini` → `carrinho`). */
function registered(name: string) {
  const p = protocol()
  let n = name
  while (n && !p.entry(n)) n = n.slice(0, Math.max(0, n.lastIndexOf('/')))
  return n ? p.entry(n) : undefined
}
