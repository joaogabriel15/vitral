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
  InjectionToken,
  createComponent,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
  reflectComponentType,
  type ApplicationConfig,
  type EnvironmentProviders,
  type Provider,
  type Type,
} from '@angular/core'
import { createApplication } from '@angular/platform-browser'
import { configure, defineRemote, type VitralConfig, type Props, type RemoteContext, type RemoteModule } from './index'
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
