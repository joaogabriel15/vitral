/**
 * Adaptador Angular (standalone, zoneless ou com zone.js).
 *
 * Remote: export default angularRemote(AppComponent, { providers: [provideHttpClient()] })
 *         Props viram inputs (`input()` ou `@Input()`); o contexto vem de `inject(VITRAL_CONTEXT)`.
 *
 * Host:   providers: [provideVitral({ remotes: '/remotes.json' })]
 *         schemas: [CUSTOM_ELEMENTS_SCHEMA]
 *         <vitral-remote name="carrinho" [props]="{ userId }" isolate="shadow"></vitral-remote>
 */
import {
  DestroyRef,
  InjectionToken,
  createComponent,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
  reflectComponentType,
  signal,
  type ApplicationConfig,
  type EnvironmentProviders,
  type Provider,
  type Signal,
  type Type,
} from '@angular/core'
import { createApplication } from '@angular/platform-browser'
import { configure, defineRemote, shared, type VitralConfig, type Props, type RemoteContext, type RemoteModule, type Shared } from './index'
import { memoSelect, same } from './core/shared'
import { defineVitralElement } from './element'

export const VITRAL_CONTEXT = new InjectionToken<RemoteContext>('vitral.context')

/** Transforma um componente standalone em um remote. */
export function angularRemote<P extends Props>(component: Type<unknown>, config: Partial<ApplicationConfig> = {}): RemoteModule<P> {
  const inputs = new Set((reflectComponentType(component)?.inputs ?? []).map((i) => i.templateName))
  return defineRemote<P>({
    async mount(el, props, ctx) {
      const app = await createApplication({
        providers: [provideZonelessChangeDetection(), { provide: VITRAL_CONTEXT, useValue: ctx }, ...(config.providers ?? [])],
      })
      const hostElement = document.createElement('div')
      el.appendChild(hostElement)
      const ref = createComponent(component, { environmentInjector: app.injector, hostElement })
      const apply = (p: Props) => {
        for (const [k, v] of Object.entries(p)) if (inputs.has(k)) ref.setInput(k, v)
      }
      apply(props)
      app.attachView(ref.hostView)
      ref.changeDetectorRef.detectChanges()
      return {
        update(next) {
          apply(next)
          app.tick()
        },
        unmount() {
          app.destroy()
          hostElement.remove()
        },
      }
    },
  })
}

/** Dentro de um remote Angular: `const vitral = injectVitral()`. */
export function injectVitral(): RemoteContext | null {
  return inject(VITRAL_CONTEXT, { optional: true })
}

/**
 * Signal de uma chave compartilhada (`provide`/`shared`). Com seletor, só
 * muda quando o resultado do seletor muda (`Object.is`). Chame num contexto de
 * injeção (construtor, inicializador de campo); a assinatura acaba no destroy.
 *
 *   usuario = injectShared('usuario')
 *   nome = injectShared('usuario', (u) => u?.nome)
 */
export function injectShared<K extends keyof Shared, S = Shared[K] | undefined>(key: K, select?: (value: Shared[K] | undefined) => S): Signal<S>
export function injectShared<T = unknown, S = T | undefined>(key: string, select?: (value: T | undefined) => S): Signal<S>
export function injectShared(key: string, select: (value: unknown) => unknown = same): Signal<unknown> {
  const destroy = inject(DestroyRef)
  const handle = shared(key)
  const pick = memoSelect()
  const value = signal(pick(handle.get(), select), { equal: Object.is })
  destroy.onDestroy(handle.subscribe((v) => value.set(pick(v, select))))
  return value.asReadonly()
}

/**
 * Host Angular: configura o vitral e registra `<vitral-remote>`. Use junto com
 * `CUSTOM_ELEMENTS_SCHEMA` no componente que renderiza o remote.
 */
export function provideVitral(config: VitralConfig = {}): (Provider | EnvironmentProviders)[] {
  return [
    provideAppInitializer(() => {
      // No SSR do Angular não existe customElements; o remote monta no cliente.
      if (typeof window === 'undefined') return
      configure(config)
      defineVitralElement()
    }),
  ]
}

export { events, navigate } from './index'
