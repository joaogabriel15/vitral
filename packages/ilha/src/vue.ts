/**
 * Adaptador Vue 3 (funciona em Vite e Nuxt 3/4).
 *
 * Host:   <IlhaRemote name="carrinho" :props="{ userId }" />
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
  mountRemote,
  type Isolation,
  type MountedRemote,
  type Props,
  type RemoteContext,
  type RemoteModule,
} from './index'

// ---------------------------------------------------------------------------
// Lado do remote
// ---------------------------------------------------------------------------

const IlhaKey: InjectionKey<RemoteContext> = Symbol('ilha')

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
      app.provide(IlhaKey, ctx)
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
export function useIlha(): RemoteContext | null {
  return inject(IlhaKey, null)
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
export const IlhaRemote = defineComponent({
  name: 'IlhaRemote',
  props: {
    name: { type: String, required: true },
    props: { type: Object as PropType<Props>, default: () => ({}) },
    isolate: { type: String as PropType<Isolation>, default: undefined },
  },
  emits: ['error', 'ready'],
  setup(p, { slots, emit }) {
    const slot = ref<HTMLElement | null>(null)
    const status = ref<'loading' | 'ready' | 'error'>('loading')
    const error = shallowRef<Error | null>(null)
    const attempt = ref(0)
    let handle: MountedRemote | null = null
    let token = 0

    function fail(e: unknown, my: number) {
      if (my !== token) return
      error.value = e as Error
      status.value = 'error'
      emit('error', e)
      if (!slots.error) console.error(e)
    }

    async function mount() {
      const my = ++token
      handle?.unmount()
      handle = null
      status.value = 'loading'
      try {
        const onError = (e: Error) => fail(e, my)
        const h = await mountRemote(slot.value!, p.name, { ...p.props }, { isolate: p.isolate, onError })
        if (my !== token) return h.unmount()
        handle = h
        status.value = 'ready'
        emit('ready')
      } catch (e) {
        fail(e, my)
      }
    }

    onMounted(mount)
    watch(() => [p.name, p.isolate, attempt.value], mount, { flush: 'post' })
    watch(
      () => p.props,
      (next) => handle?.update?.({ ...next }),
      { deep: true },
    )
    onBeforeUnmount(() => {
      token++
      handle?.unmount()
      handle = null
    })

    const retry = () => attempt.value++

    return () =>
      h('div', { 'data-ilha': p.name, 'data-ilha-status': status.value }, [
        status.value === 'loading' ? slots.fallback?.() : null,
        status.value === 'error' ? slots.error?.({ error: error.value, retry }) : null,
        // O Vue nunca coloca filhos neste div: ele pertence ao remote.
        h('div', {
          key: `${p.name}:${p.isolate}:${attempt.value}`,
          ref: slot,
          style: status.value === 'error' ? 'display:none' : undefined,
        }),
      ])
  },
})
