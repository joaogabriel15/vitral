// @vitest-environment happy-dom
// Suporte pela metade a Scoped Custom Element Registries (como no WebKit do
// Playwright): `initialize` no protótipo, mas o navegador recusa o registro.
// Arquivo à parte: depois da recusa, a lib não tenta de novo nesta página.
import { afterEach, expect, it, vi } from 'vitest'
import { __reset, mountRemote, register, type RemoteContext } from '../src/index'

afterEach(() => {
  __reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

/** Remote em Shadow DOM que guarda o `ctx`. */
async function mount(name: string) {
  const seen: { ctx?: RemoteContext } = {}
  register(name, {
    isolate: 'shadow',
    module: {
      mount(_el: HTMLElement, _p: unknown, ctx: RemoteContext) {
        seen.ctx = ctx
        return { unmount() {} }
      },
    },
  })
  const host = document.body.appendChild(document.createElement('div'))
  await mountRemote(host, name, {})
  return { host, ctx: seen.ctx! }
}

/** Opção `customElementRegistry` que o navegador conhece e recusa (TypeError). */
function refuseOption() {
  const attach = HTMLElement.prototype.attachShadow
  vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (this: HTMLElement, init: ShadowRootInit) {
    if (init.customElementRegistry) throw new TypeError('Illegal constructor')
    return attach.call(this, init)
  })
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => {
    if (options?.customElementRegistry) throw new TypeError('registro inválido')
    return create(tag, options)
  }) as typeof document.createElement)
}

it('construtor que lança: monta no Shadow DOM com o registro global, e não tenta de novo', async () => {
  let tries = 0
  class Registry {
    constructor() {
      tries++
      throw new TypeError('Illegal constructor')
    }
    initialize() {}
  }
  vi.stubGlobal('CustomElementRegistry', Registry)
  refuseOption()
  const { host, ctx } = await mount('falha-a')
  expect(host.shadowRoot!.querySelector('[data-vitral-root]')).not.toBeNull()
  class Botao extends HTMLElement {}
  ctx.customElements!.define('ds-falha', Botao)
  expect(customElements.get('ds-falha')).toBe(Botao)
  await mount('falha-b')
  expect(tries).toBe(1)
})

it('registro criado, mas recusado em attachShadow e createElement: fica no global', async () => {
  // Módulos novos da lib, sem a recusa guardada pelo teste acima.
  vi.resetModules()
  const lib = await import('../src/index')
  const { elementRemote } = await import('../src/element')
  class Registry {
    define() {}
    get() {}
    initialize() {}
  }
  vi.stubGlobal('CustomElementRegistry', Registry)
  refuseOption()
  class Widget extends HTMLElement {}
  customElements.define('x-falha', Widget)
  lib.register('falha-c', { isolate: 'shadow', module: elementRemote('x-falha') })
  const host = document.body.appendChild(document.createElement('div'))
  await lib.mountRemote(host, 'falha-c', {})
  const node = host.shadowRoot!.querySelector('x-falha')!
  expect(node).toBeInstanceOf(Widget)
  expect((node as unknown as { vitral: RemoteContext }).vitral.customElements).not.toBeInstanceOf(Registry)
  lib.__reset()
})
