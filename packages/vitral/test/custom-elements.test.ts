// @vitest-environment happy-dom
// Registro de custom elements por remote (`ctx.customElements`). O happy-dom
// não tem Scoped Custom Element Registries: o caminho com suporte é simulado.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, mountRemote, register, type RemoteContext } from '../src/index'
import { elementRemote } from '../src/element'
import { component } from '../src/index'
import { entryCode } from '../src/vite/adapter'

afterEach(() => {
  __reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  document.body.replaceChildren()
})

let n = 0
/** Nome novo por teste: o registro de cada remote vale para a página toda. */
const unique = (base: string) => `${base}-${++n}`

/** Remote que guarda o `ctx` e roda `fn` no mount. */
function remote(fn: (ctx: RemoteContext, el: HTMLElement) => void = () => {}) {
  const seen: { ctx?: RemoteContext; el?: HTMLElement } = {}
  return {
    seen,
    module: {
      mount(el: HTMLElement, _p: unknown, ctx: RemoteContext) {
        seen.ctx = ctx
        seen.el = el
        fn(ctx, el)
        return { unmount() {} }
      },
    },
  }
}

async function mount(name: string, module: ReturnType<typeof remote>['module'], isolate: 'shadow' | 'none' = 'shadow') {
  register(name, { module, isolate })
  const host = document.body.appendChild(document.createElement('div'))
  return { host, handle: await mountRemote(host, name, {}) }
}

/**
 * Simula um navegador com Scoped Custom Element Registries: `initialize` no
 * protótipo, um construtor que funciona e `attachShadow`/`createElement` que
 * guardam o registro recebido.
 */
function simulateScoped() {
  class Registry {
    defs = new Map<string, CustomElementConstructor>()
    define(tag: string, ctor: CustomElementConstructor) {
      if (this.defs.has(tag)) throw new DOMException(`${tag} já definido`, 'NotSupportedError')
      this.defs.set(tag, ctor)
    }
    get(tag: string) {
      return this.defs.get(tag)
    }
    initialize() {}
  }
  vi.stubGlobal('CustomElementRegistry', Registry)
  const attach = HTMLElement.prototype.attachShadow
  vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (this: HTMLElement, init: ShadowRootInit) {
    const root = attach.call(this, init)
    Object.defineProperty(root, 'customElementRegistry', { value: init.customElementRegistry ?? null })
    return root
  })
  const create = document.createElement.bind(document)
  const created = new Map<Element, CustomElementRegistry | undefined>()
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => {
    const el = create(tag, options)
    created.set(el, options?.customElementRegistry)
    return el
  }) as typeof document.createElement)
  return { Registry, registryOf: (el: Element) => created.get(el) }
}

describe('ctx.customElements com Scoped Custom Element Registries (simulado)', () => {
  it('cada remote ganha um registro próprio, usado pelo shadow root e pelo elemento raiz', async () => {
    const { Registry, registryOf } = simulateScoped()
    const a = remote()
    const b = remote()
    const ma = await mount(unique('a'), a.module)
    await mount(unique('b'), b.module)
    expect(a.seen.ctx!.customElements).toBeInstanceOf(Registry)
    expect(b.seen.ctx!.customElements).toBeInstanceOf(Registry)
    expect(a.seen.ctx!.customElements).not.toBe(b.seen.ctx!.customElements)
    expect((ma.host.shadowRoot as unknown as { customElementRegistry: unknown }).customElementRegistry).toBe(a.seen.ctx!.customElements)
    expect(registryOf(a.seen.el!)).toBe(a.seen.ctx!.customElements)
  })

  it('dois remotes definem <ds-button> de versões diferentes, sem colisão e sem tocar no global', async () => {
    simulateScoped()
    const global = vi.spyOn(customElements, 'define')
    class V1 extends HTMLElement {}
    class V2 extends HTMLElement {}
    const a = remote((ctx) => ctx.customElements!.define('ds-button', V1))
    const b = remote((ctx) => ctx.customElements!.define('ds-button', V2))
    await mount(unique('a'), a.module)
    await mount(unique('b'), b.module)
    expect(a.seen.ctx!.customElements!.get('ds-button')).toBe(V1)
    expect(b.seen.ctx!.customElements!.get('ds-button')).toBe(V2)
    expect(global).not.toHaveBeenCalled()
  })

  it('a remontagem reusa o registro do remote, e definir de novo não lança', async () => {
    simulateScoped()
    class Botao extends HTMLElement {}
    const name = unique('a')
    const a = remote((ctx) => ctx.customElements!.define('ds-botao', Botao))
    const first = await mount(name, a.module)
    const registry = a.seen.ctx!.customElements
    first.handle.unmount()
    await mount(name, a.module)
    expect(a.seen.ctx!.customElements).toBe(registry)
  })
})

describe('ctx.customElements sem suporte', () => {
  it('no Shadow DOM é o registro global: define e get chegam em customElements', async () => {
    class Tag extends HTMLElement {}
    const tag = unique('ds-global')
    const a = remote((ctx) => ctx.customElements!.define(tag, Tag))
    await mount(unique('a'), a.module)
    const registry = a.seen.ctx!.customElements!
    expect(registry).toBeInstanceOf(CustomElementRegistry)
    expect(customElements.get(tag)).toBe(Tag)
    expect(registry.get(tag)).toBe(Tag)
  })

  it('outro remote que define a mesma tag não quebra: fica a primeira definição, com aviso em dev', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    class V1 extends HTMLElement {}
    class V2 extends HTMLElement {}
    const tag = unique('ds-button')
    const [na, nb] = [unique('a'), unique('b')]
    await mount(na, remote((ctx) => ctx.customElements!.define(tag, V1)).module)
    const b = remote((ctx) => ctx.customElements!.define(tag, V2))
    await mount(nb, b.module)
    expect(b.seen.el!.isConnected).toBe(true)
    expect(customElements.get(tag)).toBe(V1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain(`${nb}: <${tag}> já foi definido por ${na}`)
  })

  it('a mesma classe, ou o mesmo remote remontado, não avisa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tag = unique('ds-x')
    const name = unique('a')
    // Classe nova a cada montagem, como num remote que define dentro do mount.
    const a = remote((ctx) => ctx.customElements!.define(tag, class extends HTMLElement {}))
    ;(await mount(name, a.module)).handle.unmount()
    await mount(name, a.module)
    class Same extends HTMLElement {}
    const same = unique('ds-same')
    await mount(unique('b'), remote((ctx) => ctx.customElements!.define(same, Same)).module)
    await mount(unique('c'), remote((ctx) => ctx.customElements!.define(same, Same)).module)
    expect(warn).not.toHaveBeenCalled()
  })

  it('em produção não avisa', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tag = unique('ds-prod')
    await mount(unique('a'), remote((ctx) => ctx.customElements!.define(tag, class extends HTMLElement {})).module)
    await mount(unique('b'), remote((ctx) => ctx.customElements!.define(tag, class extends HTMLElement {})).module)
    expect(warn).not.toHaveBeenCalled()
  })

  it('quem usa customElements direto continua com o define do navegador', async () => {
    const tag = unique('ds-direto')
    await mount(unique('a'), remote((ctx) => ctx.customElements!.define(tag, class extends HTMLElement {})).module)
    expect(() => customElements.define(tag, class extends HTMLElement {})).toThrow()
  })
})

it('fora do Shadow DOM, ctx.customElements é o registro global', async () => {
  const a = remote()
  await mount(unique('a'), a.module, 'none')
  expect(a.seen.ctx!.customElements).toBe(customElements)
})

describe('elementRemote com o registro do remote', () => {
  it('setup recebe ctx.customElements e o elemento é criado com ele', async () => {
    const { registryOf } = simulateScoped()
    class Widget extends HTMLElement {}
    let got: CustomElementRegistry | undefined
    const name = unique('w')
    register(name, {
      isolate: 'shadow',
      module: elementRemote('x-widget', (registry) => {
        got = registry
        registry.get('x-widget') || registry.define('x-widget', Widget)
      }),
    })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, name, {})
    const node = host.shadowRoot!.querySelector('x-widget')!
    const ctx = (node as unknown as { vitral: RemoteContext }).vitral
    expect(got).toBe(ctx.customElements)
    expect(registryOf(node)).toBe(ctx.customElements)
    expect(customElements.get('x-widget')).toBeUndefined()
  })

  it('setup pode devolver a tag do elemento', async () => {
    const name = unique('w')
    const tag = unique('x-outra')
    register(name, { module: elementRemote('x-base', () => tag) })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, name, {})
    expect(host.querySelector(tag)).not.toBeNull()
  })

  it('host antigo (sem ctx.customElements): usa o global', async () => {
    let got: CustomElementRegistry | undefined
    const mod = elementRemote('x-antigo', (registry) => void (got = registry))
    const el = document.body.appendChild(document.createElement('div'))
    await mod.mount(el, {}, { name: 'x' } as RemoteContext)
    expect(got).toBe(customElements)
  })
})

describe('entrada gerada pelo plugin para um Web Component', () => {
  /** Roda o código de `entryCode` com os imports trocados pelos módulos do teste. */
  function entry(c: unknown) {
    const code = entryCode('./x.js', 'element', 'loja')
      .replace(/^import .*$/gm, '')
      .replace(/^export default/m, 'return')
    return new Function('m', 'elementRemote', 'component', code)({ default: c }, elementRemote, component)
  }

  it('define a classe no registro do remote, não no global', async () => {
    const { Registry } = simulateScoped()
    class Loja extends HTMLElement {}
    const name = unique('loja')
    register(name, { isolate: 'shadow', module: entry(Loja) })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, name, {})
    const node = host.shadowRoot!.querySelector('loja-remote')!
    const registry = (node as unknown as { vitral: RemoteContext }).vitral.customElements as unknown as InstanceType<typeof Registry>
    expect(registry.get('loja-remote')).toBe(Loja)
    expect(customElements.get('loja-remote')).toBeUndefined()
  })
})
