/**
 * Adaptador Vue 3 (funciona em Vite e Nuxt 3/4).
 *
 * Host:   <VitralRemote name="carrinho" :props="{ userId }" />
 * Remote: export default vueRemote(App, { setup: (app) => app.use(pinia) })
 */
import {
  createApp,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowReactive,
  shallowRef,
  watch,
  type App,
  type Component,
  type InjectionKey,
  type PropType,
  type ShallowRef,
} from 'vue'
import {
  defineRemote,
  events,
  type Isolation,
  type Props,
  type RemoteSlot,
  type SlotStatus,
  type RemoteContext,
  type RemoteModule,
} from './index'
import { hostSlot, type Loading, type Prefetch } from './core/host-slot'

// ---------------------------------------------------------------------------
// Lado do remote
// ---------------------------------------------------------------------------

const VitralKey: InjectionKey<RemoteContext> = Symbol('vitral')

export interface VueRemoteOptions {
  /** Instale plugins (router, pinia, i18n…) no app do remote. */
  setup?: (app: App, ctx: RemoteContext) => void
}

/** Transforma um componente Vue em um remote. */
export function vueRemote<P extends Props>(component: Component, options: VueRemoteOptions = {}): RemoteModule<P> {
  return defineRemote<P>({
    mount(el, props, ctx) {
      const state = shallowReactive<Record<string, unknown>>({ ...props })
      const app = createApp({ render: () => h(component, state) })
      app.provide(VitralKey, ctx)
      // Erros do remote vão para o host em vez de sumirem no console.
      app.config.errorHandler = (e) => ctx.reportError(e)
      options.setup?.(app, ctx)
      app.mount(el)
      return {
        update(next) {
          for (const k of Object.keys(state)) if (!(k in next)) delete state[k]
          Object.assign(state, next)
        },
        unmount: () => app.unmount(),
      }
    },
  })
}

/** Dentro de um remote: dá acesso ao contexto (nome, eventos, baseUrl). */
export function useVitral(): RemoteContext | null {
  return inject(VitralKey, null)
}

/** Assina um evento do barramento global enquanto o componente existir. */
export function useEvent<T = unknown>(type: string, handler: (payload: T) => void): void {
  let off: (() => void) | undefined
  onMounted(() => (off = events.on<T>(type, handler)))
  onBeforeUnmount(() => off?.())
}

/** Ref com o último valor emitido em `type`. */
export function useEventValue<T = unknown>(type: string): ShallowRef<T | undefined> {
  const value = shallowRef<T | undefined>(events.last<T>(type))
  useEvent<T>(type, (v) => (value.value = v))
  return value
}

export { events }

// ---------------------------------------------------------------------------
// Lado do host
// ---------------------------------------------------------------------------

/**
 * Renderiza um remote. No servidor (Nuxt SSR) renderiza só o slot `fallback`;
 * o remote monta no cliente.
 *
 * Slots: `fallback` (carregando) e `error` ({ error, retry }).
 */
export const VitralRemote = defineComponent({
  name: 'VitralRemote',
  props: {
    name: { type: String, required: true },
    props: { type: Object as PropType<Props>, default: () => ({}) },
    isolate: { type: String as PropType<Isolation>, default: undefined },
    /** `'lazy'`: monta perto de aparecer na tela; `'idle'`: com o navegador ocioso. */
    loading: { type: String as PropType<Loading>, default: undefined },
    /** Baixa antes de montar: `'hover'`, `'visible'` ou `'idle'`. */
    prefetch: { type: String as PropType<Prefetch>, default: undefined },
    /** `'high'` para o remote que aparece logo ao abrir a página. */
    priority: { type: String as PropType<RequestPriority>, default: undefined },
    /** Ao sair da página, guarda o remote montado (LRU, padrão 5) e na volta só atualiza as props. */
    keepAlive: { type: [Boolean, Number], default: false },
  },
  emits: ['error', 'ready'],
  setup(p, { slots, emit }) {
    const target = ref<HTMLElement | null>(null)
    const status = ref<SlotStatus>('loading')
    const error = shallowRef<Error | null>(null)
    let slot: RemoteSlot | null = null

    onMounted(() => {
      slot = hostSlot(target.value!, {
        name: p.name,
        props: { ...p.props },
        isolate: p.isolate,
        loading: p.loading,
        prefetch: p.prefetch,
        priority: p.priority,
        keepAlive: p.keepAlive,
        onStatus(s, e) {
          status.value = s
          error.value = e
          if (s === 'ready') emit('ready')
          if (e) {
            emit('error', e)
            if (!slots.error) console.error(e)
          }
        },
      })
    })
    watch(() => [p.name, p.isolate] as const, ([name, isolate]) => slot?.set({ name, isolate }), { flush: 'post' })
    watch(
      () => p.props,
      (next) => slot?.update({ ...next }),
      { deep: true },
    )
    onBeforeUnmount(() => {
      slot?.destroy()
      slot = null
    })

    const retry = () => slot?.retry()

    return () =>
      h('div', { 'data-vitral': p.name, 'data-vitral-status': status.value }, [
        status.value === 'loading' ? slots.fallback?.() : null,
        status.value === 'error' ? slots.error?.({ error: error.value, retry }) : null,
        // O Vue nunca coloca filhos neste div: ele pertence ao remote.
        h('div', { ref: target }),
      ])
  },
})
