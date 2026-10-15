/**
 * Recursos dos componentes de host que ficam fora do host mínimo: montagem
 * sob demanda (`loading`), download antecipado (`prefetch`) e keep-alive.
 * O `<vitral-remote>` e os componentes de cada framework usam `hostSlot()`.
 */
import { preload } from './loader'
import { registerSrc } from './registry'
import { createSlot, type RemoteSlot, type SlotOptions, type SlotStatus } from './slot'
import type { Props } from './types'
import type { RemoteError } from './errors'

/** Quando montar: já (`eager`, padrão), perto de aparecer na tela (`lazy`) ou com o navegador ocioso (`idle`). */
export type Loading = 'eager' | 'lazy' | 'idle'
/** Quando baixar antes de montar: no hover ou foco (`hover`), perto de aparecer (`visible`) ou com o navegador ocioso (`idle`). */
export type Prefetch = 'hover' | 'visible' | 'idle'

export interface HostSlotOptions<P extends Props = Props> extends SlotOptions<P> {
  loading?: Loading | null
  prefetch?: Prefetch | null
  /**
   * Ao sair da página, o remote vai para um contêiner oculto em vez de
   * desmontar; na volta só recebe as props novas. `true` guarda até 5
   * remotes (LRU); um número muda esse máximo.
   */
  keepAlive?: boolean | number
}

const noop = () => {}

/** Chama `fn` uma vez, na hora pedida por `mode`. Devolve a função que cancela. */
export function when(el: Element, mode: string | null | undefined, fn: () => void): () => void {
  if (mode === 'lazy' || mode === 'visible') {
    if (typeof IntersectionObserver === 'undefined') return fn(), noop
    // 200px de margem: começa um pouco antes de o remote aparecer.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) io.disconnect(), fn()
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }
  if (mode === 'idle') {
    if (typeof requestIdleCallback === 'undefined') {
      const t = setTimeout(fn, 1)
      return () => clearTimeout(t)
    }
    const id = requestIdleCallback(fn, { timeout: 2000 })
    return () => cancelIdleCallback(id)
  }
  if (mode === 'hover') {
    const go = () => (off(), fn())
    const off = () => {
      el.removeEventListener('pointerenter', go)
      el.removeEventListener('focusin', go)
    }
    el.addEventListener('pointerenter', go)
    el.addEventListener('focusin', go)
    return off
  }
  fn()
  return noop
}

// ---------------------------------------------------------------------------
// Keep-alive: LRU de remotes fora da página
// ---------------------------------------------------------------------------

interface Kept {
  box: HTMLElement
  slot: RemoteSlot<any>
  /** Quem recebe as mudanças de estado: o componente de host atual. */
  on: (status: SlotStatus, error: RemoteError | null) => void
}

const kept = new Map<string, Kept>()
let shelf: HTMLElement | null = null

/** Move sem recriar, onde o navegador permite (`moveBefore` mantém iframes e foco). */
function move(parent: Element, node: Element) {
  try {
    ;(parent as any).moveBefore(node, null)
  } catch {
    parent.appendChild(node)
  }
}

/** Avisa os remotes dentro de `node` (inclusive em shadow roots). */
function signal(node: ParentNode, type: string) {
  for (const el of node.querySelectorAll('*')) {
    if (el.hasAttribute('data-vitral-root')) el.dispatchEvent(new Event(type))
    if (el.shadowRoot) signal(el.shadowRoot, type)
  }
}

function park(key: string, item: Kept, max: number) {
  kept.get(key)?.slot.destroy()
  kept.delete(key)
  if (!shelf?.isConnected) {
    shelf = document.createElement('div')
    shelf.hidden = true
    shelf.setAttribute('data-vitral-keep-alive', '')
    document.body.appendChild(shelf)
  }
  move(shelf, item.box)
  signal(item.box, 'vitral:deactivate')
  kept.set(key, item)
  // O mais antigo sai primeiro (Map guarda a ordem de inserção).
  for (const [k, old] of kept) {
    if (kept.size <= max) break
    kept.delete(k)
    old.slot.destroy()
    old.box.remove()
  }
}

/** Esvazia o keep-alive, desmontando tudo (útil em testes e no logout). */
export function clearKeepAlive(): void {
  for (const { slot, box } of kept.values()) slot.destroy(), box.remove()
  kept.clear()
}

/**
 * `createSlot` com `loading`, `prefetch` e `keepAlive`. Sem essas opções,
 * é o próprio `createSlot`.
 */
export function hostSlot<P extends Props = Props>(target: HTMLElement, options: HostSlotOptions<P>): RemoteSlot<P> {
  let { props = {} as P, keepAlive } = options
  // Com `src`, a chave do prefetch e do keep-alive é o nome registrado.
  const key = (o: Pick<SlotOptions<P>, 'name' | 'src'>) => (o.src ? registerSrc(o.src, o.name) : (o.name ?? ''))
  let name = key(options)
  let status: SlotStatus = 'loading'
  let item: Kept | null = null
  const onStatus = (s: SlotStatus, e: RemoteError | null) => {
    status = s
    options.onStatus?.(s, e)
  }
  const cancelPrefetch = options.prefetch ? when(target, options.prefetch, () => preload(name)) : noop
  const cancel = when(target, options.loading, () => {
    cancelPrefetch()
    const found = keepAlive ? kept.get(name) : undefined
    if (found) {
      kept.delete(name)
      item = found
      item.on = onStatus
      move(target, item.box)
      item.slot.update(props)
      signal(item.box, 'vitral:activate')
      onStatus(item.slot.status, null)
      return
    }
    let box = target
    if (keepAlive) {
      box = target.appendChild(document.createElement('div'))
      box.style.display = 'contents'
    }
    const it: Kept = { box, on: onStatus, slot: null as unknown as RemoteSlot<P> }
    it.slot = createSlot<P>(box, { ...options, name, src: undefined, props, onStatus: (s, e) => it.on(s, e) })
    item = it
  })

  return {
    update(next) {
      props = next
      item?.slot.update(next)
    },
    set(next) {
      if (next.src || next.name !== undefined) name = key(next)
      item?.slot.set({ ...next, src: undefined, name })
    },
    retry: () => item?.slot.retry(),
    destroy() {
      cancel()
      cancelPrefetch()
      if (!item) return
      if (keepAlive && status === 'ready') park(name, item, keepAlive === true ? 5 : keepAlive)
      else {
        item.slot.destroy()
        if (item.box !== target) item.box.remove()
      }
      item = null
    },
    get status() {
      return status
    },
  }
}
