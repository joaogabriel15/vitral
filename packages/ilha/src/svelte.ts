/**
 * Adaptador Svelte 5 (e SvelteKit).
 *
 * Remote: export default svelteRemote(App)
 * Host:   <div use:remote={{ name: 'carrinho', props: { userId } }}></div>
 *         ou o Web Component <ilha-remote> de 'ilha/element'.
 */
import type { Component } from 'svelte'
import { createClassComponent } from 'svelte/legacy'
import { createSlot, defineRemote, type Isolation, type Props, type RemoteContext, type RemoteError, type RemoteModule, type SlotStatus } from './index'

/** Transforma um componente Svelte em um remote. O contexto chega na prop `ilha`. */
export function svelteRemote<P extends Props>(component: Component<any>): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      // A API de classe mantém o estado interno ao atualizar props.
      const instance = createClassComponent({ component, target: el, props: { ...props, ilha: ctx } })
      return {
        update: (next) => instance.$set({ ...next, ilha: ctx }),
        unmount: () => instance.$destroy(),
      }
    },
  })
}

export interface RemoteActionParams<P extends Props = Props> {
  name: string
  props?: P
  isolate?: Isolation
  onStatus?: (status: SlotStatus, error: RemoteError | null) => void
}

/** Action Svelte: `<div use:remote={{ name, props }}>`. Funciona também em SvelteKit (só roda no cliente). */
export function remote<P extends Props = Props>(node: HTMLElement, params: RemoteActionParams<P>) {
  const slot = createSlot<P>(node, params)
  return {
    update(next: RemoteActionParams<P>) {
      slot.set({ name: next.name, isolate: next.isolate })
      slot.update((next.props ?? {}) as P)
    },
    destroy: () => slot.destroy(),
  }
}

export type { RemoteContext }
export { events, navigate } from './index'
