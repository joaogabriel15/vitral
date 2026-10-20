// @vitest-environment happy-dom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { events, mountRemote, provide, register, type RemoteModule } from '../src/index'
import { CONTRACT_SCHEMA, harness, record, resetVitral, verify, type Contract } from '../src/testing'
import { decode, encode } from '../src/harness'
import { cleanup, flush } from './helpers'

afterEach(cleanup)

/** Remote de exemplo: mostra itens, escuta `tema`, emite `carrinho:pronto` no mount e `carrinho:compra` no clique. */
const carrinho: RemoteModule<{ itens: number; onFechar?: () => void }> = {
  mount(el, props, ctx) {
    const render = (p: typeof props) => (el.innerHTML = `<button>${p.itens} itens</button>`)
    render(props)
    const usuario = ctx.shared?.('usuario').get()
    el.dataset.usuario = String((usuario as { nome?: string } | undefined)?.nome ?? '')
    el.dataset.tema = String(ctx.events.last('tema') ?? '')
    const off = ctx.events.on<string>('tema', (t) => {
      el.dataset.tema = t
      ctx.events.emit('carrinho:tema-aplicado', t)
    })
    el.addEventListener('click', () => ctx.events.emit('carrinho:compra', { total: 10 }))
    ctx.events.emit('carrinho:pronto')
    return {
      update: (p) => render(p),
      unmount() {
        off()
        el.replaceChildren()
      },
    }
  },
}

describe('harness', () => {
  it('monta com ctx simulado e grava eventos, erros e navegação', async () => {
    const h = await harness(carrinho, { props: { itens: 2 }, shared: { usuario: { nome: 'Ana' } }, last: { tema: 'claro' }, name: 'carrinho' })
    expect(h.el.textContent).toBe('2 itens')
    expect(h.el.dataset.usuario).toBe('Ana')
    expect(h.el.dataset.tema).toBe('claro')
    expect(h.ctx.name).toBe('carrinho')
    expect(h.ctx.portalContainer).toBe(document.body)
    expect(h.ctx.customElements).toBe(customElements)
    expect(h.events).toEqual([{ type: 'carrinho:pronto', payload: undefined }])
    expect(h.listens()).toEqual(['tema'])
    h.emit('tema', 'escuro')
    expect(h.el.dataset.tema).toBe('escuro')
    expect(h.events.at(-1)).toEqual({ type: 'carrinho:tema-aplicado', payload: 'escuro' })
    h.update({ itens: 3 })
    expect(h.el.textContent).toBe('3 itens')
    h.ctx.navigate('/checkout', { replace: true })
    h.ctx.reportError(new Error('x'))
    expect(h.navigations).toEqual([{ url: '/checkout', options: { replace: true } }])
    expect(h.errors).toHaveLength(1)
    h.unmount()
    expect(h.listens()).toEqual([])
    expect(document.body.children).toHaveLength(0)
    h.update({ itens: 9 })
    h.unmount()
  })

  it('aceita default, shadow root, keep-alive e ctx sobrescrito', async () => {
    const calls: string[] = []
    const mod = {
      default: {
        mount(el: HTMLElement, _p: object, ctx: any) {
          ctx.onActivate(() => calls.push('ativo'))
          ctx.onDeactivate(() => calls.push('pausado'))
          const v = ctx.shared('n')
          v.subscribe((x: number) => calls.push(`n=${x}`))
          v.update((x: number) => (x ?? 0) + 1)
          ctx.shared.provide('n', 99)
          ctx.shared.batch(() => v.set(5))
          ctx.shared.provide('m', 1)
          calls.push(`m=${ctx.shared('m').get()}`)
          el.textContent = ctx.baseUrl
          return { unmount() {} }
        },
      },
    }
    const target = document.body.appendChild(document.createElement('section'))
    const h = await harness(mod, { props: {}, shadow: true, target, ctx: { baseUrl: 'https://cdn/x/' } })
    expect(h.ctx.shadowRoot).toBe(target.shadowRoot)
    expect(h.ctx.portalContainer?.parentNode).toBe(target.shadowRoot)
    expect(h.el.textContent).toBe('https://cdn/x/')
    h.activate()
    h.deactivate()
    expect(calls).toEqual(['n=undefined', 'n=1', 'n=5', 'm=1', 'ativo', 'pausado'])
    h.unmount()
    expect(target.isConnected).toBe(true)
  })

  it('recusa módulo sem mount e guarda erro de handler', async () => {
    await expect(harness({} as any, { props: {} })).rejects.toThrow('mount')
    const h = await harness({ mount: (_el, _p, ctx) => (ctx.events.on('x', () => { throw new Error('ruim') }), { unmount() {} }) }, { props: {} })
    h.emit('x')
    expect(String(h.errors[0])).toContain('ruim')
  })
})

describe('encode e decode', () => {
  it('troca o que o JSON não guarda por marcadores e volta', () => {
    const circular: any = { a: 1 }
    circular.eu = circular
    const enc = encode({ f() {}, d: new Date(0), m: new Map(), n: [1, undefined], u: undefined, b: 1n, c: circular, x: Object.create(null) })
    expect(enc).toEqual({ f: { $fn: true }, d: { $date: '1970-01-01T00:00:00.000Z' }, m: { $unknown: 'Map' }, n: [1, null], b: { $unknown: 'bigint' }, c: { a: 1, eu: { $unknown: 'circular' } }, x: {} })
    const paths: string[] = []
    const dec = decode({ ...(enc as object), l: [{ $fn: true }] }, (p) => (paths.push(p), () => 1)) as any
    expect(dec.f()).toBe(1)
    expect(dec.d).toEqual(new Date(0))
    expect(dec.m).toBeUndefined()
    expect(paths).toEqual(['f', 'l[0]'])
    expect(typeof (decode({ $fn: true }) as () => void)).toBe('function')
  })
})

describe('record', () => {
  it('grava props, updates, eventos do host, shared e last de cada remote', async () => {
    const rec = record({ host: 'loja' })
    provide('usuario', { nome: 'Ana' })
    events.emit('tema', 'claro')
    const vistos: unknown[] = []
    events.on('carrinho:compra', (p) => vistos.push(p))
    events.on('carrinho:pronto', () => events.emit('host:ok'))
    events.on('carrinho:tema-aplicado', () => {})
    register('carrinho', { module: carrinho })
    const el = document.body.appendChild(document.createElement('div'))
    const m = await mountRemote(el, 'carrinho', { itens: 2, onFechar: () => {} })
    m.update?.({ itens: 3 })
    events.emit('tema', 'escuro')
    ;(el.querySelector('button') as HTMLElement).click()
    // Uma segunda montagem igual não vira outro caso.
    m.unmount()
    events.emit('tema', 'claro')
    const m2 = await mountRemote(el, 'carrinho', { itens: 2, onFechar: () => {} })
    m2.update?.({ itens: 3 })
    events.emit('tema', 'escuro')
    ;(el.querySelector('button') as HTMLElement).click()
    m2.unmount()
    expect(vistos).toEqual([{ total: 10 }, { total: 10 }])
    const c = rec.contracts().carrinho
    expect(c).toEqual({
      $schema: CONTRACT_SCHEMA,
      remote: 'carrinho',
      host: 'loja',
      cases: [
        {
          props: { itens: 2, onFechar: { $fn: true } },
          updates: [{ itens: 3 }],
          inputs: [{ type: 'tema', payload: 'escuro' }],
          last: { tema: 'claro' },
          shared: { usuario: { nome: 'Ana' } },
          emits: [
            { type: 'carrinho:pronto', phase: 'mount' },
            { type: 'carrinho:tema-aplicado', phase: 'input' },
            { type: 'carrinho:compra', phase: 'later' },
          ],
          listens: ['tema'],
        },
      ],
    })
    const dir = mkdtempSync(join(resolve(__dirname, '../node_modules/.cache'), 'contrato-'))
    try {
      const [file] = await rec.save(dir)
      expect(file).toBe(join(dir, 'carrinho.contract.json'))
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(c)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    rec.stop()
    // Depois de stop, nada mais é gravado.
    const m3 = await mountRemote(el, 'carrinho', { itens: 7 })
    m3.unmount()
    expect(rec.contracts().carrinho.cases).toHaveLength(1)
  })

  it('limita os casos, guarda a versão e ignora módulo sem mount', async () => {
    const rec = record({ max: 2 })
    register('lista', { module: { mount: (el: HTMLElement, p: { n: number }) => ((el.textContent = String(p.n)), { unmount() {} }) } })
    const el = document.body.appendChild(document.createElement('div'))
    for (const n of [1, 2, 3]) (await mountRemote(el, 'lista', { n })).unmount()
    expect(rec.contracts().lista.cases.map((c) => c.props)).toEqual([{ n: 1 }, { n: 2 }])
    expect(rec.contracts().lista.host).toBeUndefined()
    const p = (globalThis as any)[Symbol.for('vitral')]
    const r = await p.load('x', async () => ({ module: { a: 1 }, entry: '', css: [], version: '1.2.0', name: 'x' }))
    expect(r.module).toEqual({ a: 1 })
    rec.stop()
    resetVitral()
  })

  it('grava o caso mesmo quando o mount falha', async () => {
    const rec = record()
    register('quebra', { module: { mount: () => Promise.reject(new Error('não')) } })
    await expect(mountRemote(document.body, 'quebra', { a: 1 })).rejects.toThrow()
    expect(rec.contracts().quebra.cases).toEqual([{ props: { a: 1 } }])
    rec.stop()
    await flush()
  })
})

describe('verify', () => {
  const contrato: Contract = {
    remote: 'carrinho',
    cases: [
      {
        props: { itens: 2, onFechar: { $fn: true } },
        updates: [{ itens: 3 }],
        inputs: [{ type: 'tema', payload: 'escuro' }],
        last: { tema: 'claro' },
        shared: { usuario: { nome: 'Ana' } },
        emits: [
          { type: 'carrinho:pronto', phase: 'mount' },
          { type: 'carrinho:tema-aplicado', phase: 'input' },
          { type: 'carrinho:compra', phase: 'later' },
        ],
        listens: ['tema'],
      },
    ],
  }

  it('passa quando o remote cumpre o contrato', async () => {
    const r = await verify(contrato, carrinho, { sources: ["emit('carrinho:compra')"] })
    expect(r).toEqual({ cases: 1, failures: [], warnings: [] })
    const sem = await verify(contrato, carrinho)
    expect(sem.failures).toEqual([])
    expect(sem.warnings[0]).toContain('carrinho:compra')
  })

  it('falha quando um evento que o host escuta some, e avisa do que o remote não escuta mais', async () => {
    const novo: RemoteModule = {
      mount(el) {
        el.textContent = 'oi'
        return { unmount() {} }
      },
    }
    const r = await verify(contrato, novo, { sources: ['nada aqui'] })
    expect(r.failures).toEqual([
      'caso 1: o host escuta "carrinho:pronto" e o remote não emitiu (na gravação saiu no mount)',
      'caso 1: o host escuta "carrinho:tema-aplicado" e o remote não emitiu (na gravação saiu no input)',
      'caso 1: o host escuta "carrinho:compra" e o código do remote não tem mais esse evento',
    ])
    expect(r.warnings).toEqual(['caso 1: o host emite "tema" e o remote não escuta mais'])
  })

  it('falha com erro no mount, update, unmount e reportError', async () => {
    const quebra: RemoteModule = { mount: () => { throw new Error('sem itens') } }
    expect((await verify(contrato, quebra)).failures).toEqual(['caso 1: erro no mount: sem itens'])
    const ruim: RemoteModule = {
      mount(_el, _p, ctx) {
        ctx.reportError(new Error('render'))
        return {
          update() {
            throw new Error('upd')
          },
          unmount() {
            throw new Error('fim')
          },
        }
      },
    }
    const r = await verify({ remote: 'x', cases: [{ props: {}, updates: [{}] }] }, ruim)
    expect(r.failures).toEqual(['caso 1: erro no update 1: upd', 'caso 1: erro no unmount: fim', 'caso 1: erro reportado: render'])
    expect((await verify({ remote: 'x', cases: [] }, ruim)).warnings).toEqual(['contrato sem casos'])
  })

  it('reproduz o contrato que record gravou', async () => {
    const rec = record()
    events.on('carrinho:pronto', () => {})
    register('carrinho', { module: carrinho })
    const m = await mountRemote(document.body.appendChild(document.createElement('div')), 'carrinho', { itens: 1 })
    m.unmount()
    const gravado = rec.contracts().carrinho
    rec.stop()
    expect(await verify(gravado, carrinho)).toEqual({ cases: 1, failures: [], warnings: [] })
  })
})

describe('schema do contrato', () => {
  const schema = JSON.parse(readFileSync(resolve(__dirname, '../../../docs/public/schema/vitral-contract.json'), 'utf8'))

  it('está publicado no endereço do $schema e tem os campos que record grava', () => {
    expect(schema.$id).toBe(CONTRACT_SCHEMA)
    expect(Object.keys(schema.properties)).toEqual(['$schema', 'remote', 'host', 'version', 'cases'])
    expect(Object.keys(schema.$defs.case.properties)).toEqual(['props', 'updates', 'inputs', 'last', 'shared', 'emits', 'listens'])
    expect(schema.$defs.case.properties.emits.items.properties.phase.enum).toEqual(['mount', 'update', 'input', 'later'])
  })
})
