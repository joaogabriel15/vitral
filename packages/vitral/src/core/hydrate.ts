/**
 * Hidratação do HTML que o gateway (`vitral/edge`) renderizou no servidor.
 * Fica num módulo à parte, baixado só quando o `<vitral-remote>` chega com um
 * filho `[data-vitral-ssr]`.
 *
 * O gateway escreve o mesmo DOM que a montagem cria:
 *
 *   <div data-vitral-ssr data-vitral-slot="carrinho">
 *     <template shadowrootmode="open">            (só com isolate="shadow")
 *       <style data-vitral-ssr>…</style>
 *       <div data-vitral-root="carrinho" style="display:contents">…</div>
 *     </template>
 *   </div>
 *
 * Se o remote exporta `hydrate`, ele recebe esse `[data-vitral-root]`. Se não
 * exporta (ou o DOM não bate com o isolamento), o caminho de sempre monta ao
 * lado e o HTML do servidor sai quando a montagem termina.
 *
 * O gateway põe também o manifesto que usou, num
 * `<script type="application/json" data-vitral-manifest="url">`: a hidratação
 * usa essa versão (a mesma do HTML) sem buscar o manifesto de novo.
 */
// `RemoteError` e `navigate` vêm de '../index' para este módulo alcançar
// tudo o que o host já carregou: sem isso, o build separaria em outro chunk a
// parte do núcleo que este módulo não usa, uma requisição a mais para todo host.
import { navigate, RemoteError } from '../index'
import { injectStyles } from './css'
import { isRemoteError, report } from './errors'
import { scopedEvents } from './events'
import { hostSlot, type HostSlotOptions } from './host-slot'
import { ctxHooks } from './hooks'
import { load } from './loader'
import { mountOnce, registered, type MountOptions } from './mount'
import type { RemoteSlot, SlotStatus } from './slot'
import { protocol } from './state'
import type { MountedRemote, Props, RemoteContext, RemoteManifest } from './types'
import { refreshable, track } from './updates'
import { absolute, metric } from './util'

/**
 * `hostSlot` que começa hidratando `holder` (o `[data-vitral-ssr]` dentro de
 * `target`). Trocar de remote, `retry` e falta de `hydrate` caem no `hostSlot`.
 */
export function hydrateSlot<P extends Props = Props>(target: HTMLElement, holder: HTMLElement, options: HostSlotOptions<P>): RemoteSlot<P> {
  const name = options.name ?? ''
  let props = (options.props ?? {}) as P
  let handle: MountedRemote<P> | null = null
  let inner: RemoteSlot<P> | null = null
  let status: SlotStatus = 'loading'
  let dead = false
  const setStatus = (s: SlotStatus, e: RemoteError | null = null) => {
    status = s
    options.onStatus?.(s, e)
  }
  /** Caminho de sempre. O HTML do servidor fica na tela até a montagem nova sair. */
  const fallback = (next: Partial<HostSlotOptions<P>> = {}) => {
    handle?.unmount()
    handle = null
    inner = hostSlot<P>(target, {
      ...options,
      ...next,
      props,
      onStatus(s, e) {
        if (s !== 'loading') holder.remove()
        if (s !== 'loading' || !holder.isConnected) setStatus(s, e)
      },
    })
  }
  const initial = props
  hydrateRemote(holder, name, props, options).then(
    (h) => {
      if (dead) return h?.unmount()
      if (!h) return fallback()
      handle = h
      if (props !== initial) h.update?.(props)
      setStatus('ready')
    },
    (e) => {
      if (dead) return
      holder.remove()
      setStatus('error', isRemoteError(e) ? e : new RemoteError('MOUNT_FAILED', name, String(e), e))
    },
  )
  return {
    update(next) {
      props = next
      ;(inner ?? handle)?.update?.(next)
    },
    set(next) {
      if (inner) return inner.set(next)
      const changed = (next.name !== undefined && next.name !== name) || ('isolate' in next && next.isolate !== options.isolate)
      if (changed) holder.remove(), fallback(next)
    },
    retry() {
      if (inner) return inner.retry()
      holder.remove()
      fallback()
    },
    destroy() {
      dead = true
      inner?.destroy()
      handle?.unmount()
      holder.remove()
    },
    get status() {
      return inner?.status ?? status
    },
  }
}

/**
 * Hidrata o remote em `holder`. Resolve `null` quando não dá para hidratar
 * (remote sem `hydrate`, isolamento diferente do HTML, iframe); quem chamou
 * monta do jeito normal. O `ctx` é o mesmo da montagem (`mountOnce`).
 */
export async function hydrateRemote<P extends Props>(holder: HTMLElement, name: string, props: P, options: MountOptions): Promise<MountedRemote<P> | null> {
  const p = protocol()
  await p.pending()
  const isolate = options.isolate ?? registered(name)?.isolate ?? p.settings().isolate
  if (isolate === 'iframe') return null
  // Manifesto do HTML: vale só para este load (o registro volta como estava).
  const entry = p.entry(name)
  const seed = entry?.url && !entry.manifest ? manifestFrom(holder, entry.url) : undefined
  if (seed) entry!.manifest = seed
  const { module: mod, ...resolved } = await load(name, isolate, options.priority).finally(() => seed && entry!.manifest === seed && delete entry!.manifest)
  const shadow = isolate === 'shadow'
  // Filho direto (`:scope` não vale num shadow root em todo navegador).
  const el = [...((shadow ? holder.shadowRoot : holder)?.children ?? [])].find((c) => c.hasAttribute('data-vitral-root')) as HTMLElement | undefined
  if (typeof mod.hydrate !== 'function' || !el) return null
  const untrack = track(name, resolved)
  ctxHooks.watch?.(name)
  const label = resolved.name ?? name
  let t = performance.now()
  // `make` devolve a raiz que veio do servidor: `./shadow` reusa o shadow
  // root declarativo e põe os estilos e o destino de portais em volta dela.
  const [release, portal = document.body, shadowRoot = null, registry = customElements] = await injectStyles(resolved, shadow && holder, () => el, options.styles)
  // Com as folhas adotadas, o `<style>` do servidor sobra.
  if (shadowRoot?.adoptedStyleSheets.length) for (const s of shadowRoot.querySelectorAll('style[data-vitral-ssr]')) s.remove()
  metric(name, 'css', t)
  t = performance.now()
  const scoped = scopedEvents()
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
    protocol: p.protocol,
    onActivate: on('vitral:activate'),
    onDeactivate: on('vitral:deactivate'),
  }
  if (ctxHooks.shared) ctx.shared = ctxHooks.shared(name, scoped.track)
  let mounted: MountedRemote<P>
  try {
    mounted = await mod.hydrate(el, props as never, ctx) as MountedRemote<P>
    metric(name, 'mount', t)
  } catch (e) {
    untrack()
    scoped.dispose()
    release()
    el.remove()
    throw report(new RemoteError('MOUNT_FAILED', label, 'erro ao hidratar', e), resolved)
  }
  let alive = true
  const current: MountedRemote<P> = {
    update(next) {
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
  // `refresh(nome)` troca pela versão nova montada do jeito normal, no mesmo lugar.
  return refreshable(current, name, props, (latest) => mountOnce(holder, name, latest, options))
}

/** Manifesto que o gateway pôs em `holder` para `url`, ou `undefined`. */
function manifestFrom(holder: HTMLElement, url: string): RemoteManifest | undefined {
  for (const s of holder.querySelectorAll(':scope>script[data-vitral-manifest]')) {
    if (absolute(s.getAttribute('data-vitral-manifest') ?? '') !== url) continue
    try {
      const m = JSON.parse(s.textContent ?? '')
      if (typeof m?.entry === 'string') return m
    } catch {
      // JSON inválido: busca o manifesto como sempre.
    }
  }
}
