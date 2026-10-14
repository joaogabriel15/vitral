// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, batch, mountRemote, provide, register, RemoteError, shared, type RemoteContext } from '../src/index'
import { isDev } from '../src/core/shared'
import { createStore, type SharedStore } from '../src/core/store'
import { protocol } from '../src/core/state'

afterEach(() => {
  __reset()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  document.head.replaceChildren()
  document.body.replaceChildren()
})

const KEY = Symbol.for('vitral')
const store = () => protocol().shared!()
const entry = (key: string) => store().list().find((e) => e.key === key)

describe('provide e shared', () => {
  it('get, set, update e subscribe', () => {
    const usuario = provide('usuario', { nome: 'Ana' })
    const seen: unknown[] = []
    const off = shared<{ nome: string }>('usuario').subscribe((u) => seen.push(u?.nome))
    usuario.set({ nome: 'Bia' })
    shared<{ nome: string }>('usuario').update((u) => ({ nome: u!.nome + '!' }))
    off()
    usuario.set({ nome: 'Caio' })
    expect(seen).toEqual(['Ana', 'Bia', 'Bia!'])
    expect(usuario.get()).toEqual({ nome: 'Caio' })
  })

  it('chave sem valor devolve undefined e recebe o valor quando o dono chega', () => {
    const seen: unknown[] = []
    shared('tema').subscribe((t) => seen.push(t))
    provide('tema', 'claro')
    expect(seen).toEqual([undefined, 'claro'])
  })

  it('mesmo valor (Object.is) não notifica', () => {
    const fn = vi.fn()
    const n = provide('n', NaN)
    n.subscribe(fn)
    n.set(NaN)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('quem chama provide primeiro é o dono; o segundo não grava', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = provide('tema', 'claro', { writable: false })
    const b = provide('tema', 'escuro', { writable: false })
    expect(a.get()).toBe('claro')
    expect(() => b.set('escuro')).toThrow(RemoteError)
    a.set('escuro')
    expect(b.get()).toBe('escuro')
    expect(warn).not.toHaveBeenCalled()
  })

  it('writable: false lança SHARED_READONLY em desenvolvimento', () => {
    provide('tema', 'claro', { writable: false })
    const e = (() => {
      try {
        shared('tema').set('escuro')
      } catch (e) {
        return e as RemoteError
      }
    })()
    expect(e?.code).toBe('SHARED_READONLY')
    expect(e?.remote).toBe('shared')
    expect(e?.message).toContain('"tema"')
    expect(shared('tema').get()).toBe('claro')
  })

  it('writable: false em produção ignora com aviso', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    provide('tema', 'claro', { writable: false })
    shared('tema').update(() => 'escuro')
    expect(shared('tema').get()).toBe('claro')
    expect(warn.mock.calls[0][0]).toContain('SHARED_READONLY')
  })

  it('sem process (sem bundler) vale como produção', () => {
    const saved = globalThis.process
    ;(globalThis as any).process = undefined
    try {
      expect(isDev()).toBe(false)
    } finally {
      globalThis.process = saved
    }
    expect(isDev()).toBe(true)
  })

  it('serviços também: funções no valor', () => {
    provide('auth', { getToken: () => 'abc' })
    expect(shared<{ getToken(): string }>('auth').get()!.getToken()).toBe('abc')
  })

  it('a mesma função pode assinar duas vezes', () => {
    const fn = vi.fn()
    const n = provide('n', 0)
    const off1 = n.subscribe(fn)
    n.subscribe(fn)
    off1()
    n.set(1)
    expect(fn).toHaveBeenLastCalledWith(1)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('uma assinatura com erro não impede as outras', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ok = vi.fn()
    const n = provide('n', 0)
    shared('n').subscribe((v) => {
      if (v) throw new Error('boom')
    })
    n.subscribe(ok)
    n.set(1)
    expect(ok).toHaveBeenLastCalledWith(1)
    expect(error).toHaveBeenCalled()
  })
})

describe('batch', () => {
  it('uma notificação por chave, no fim', () => {
    const a = provide('a', 0)
    const b = provide('b', 0)
    const fa = vi.fn()
    const fb = vi.fn()
    a.subscribe(fa)
    b.subscribe(fb)
    const out = batch(() => {
      a.set(1)
      a.set(2)
      batch(() => b.set(1))
      expect(fb).toHaveBeenCalledTimes(1)
      return 'ok'
    })
    expect(out).toBe('ok')
    expect(fa.mock.calls).toEqual([[0], [2]])
    expect(fb.mock.calls).toEqual([[0], [1]])
  })

  it('valor que volta ao de antes não notifica; erro no meio ainda notifica', () => {
    const a = provide('a', 0)
    const fa = vi.fn()
    a.subscribe(fa)
    batch(() => {
      a.set(1)
      a.set(0)
    })
    expect(fa).toHaveBeenCalledTimes(1)
    expect(() =>
      batch(() => {
        a.set(5)
        throw new Error('x')
      }),
    ).toThrow('x')
    expect(fa).toHaveBeenLastCalledWith(5)
  })
})

describe('protocolo', () => {
  it('duas cópias da lib veem o mesmo store', async () => {
    vi.resetModules()
    const a = await import('../src/index')
    vi.resetModules()
    const b = await import('../src/index')
    expect(a.provide).not.toBe(b.provide)

    const usuario = a.provide('usuario', { id: 42 }, { writable: false })
    const seen: unknown[] = []
    b.shared('usuario').subscribe((u) => seen.push(u))
    a.batch(() => usuario.set({ id: 7 }))
    expect(seen).toEqual([{ id: 42 }, { id: 7 }])
    expect(() => b.shared('usuario').set({ id: 1 })).toThrow(/SHARED_READONLY/)
  })

  it('instala o store num protocolo de uma versão sem store', () => {
    const old = { ...protocol() }
    delete old.shared
    ;(globalThis as any)[KEY] = old
    provide('x', 1)
    expect((globalThis as any)[KEY]).toBe(old)
    expect(typeof old.shared).toBe('function')
    expect(shared('x').get()).toBe(1)
  })

  it('usa o store que uma versão mais nova já instalou', () => {
    const custom: SharedStore = createStore({ x: 'de outra versão' })
    ;(globalThis as any)[KEY] = { ...protocol(), protocol: 2, shared: () => custom }
    expect(shared('x').get()).toBe('de outra versão')
    provide('y', 1)
    expect(custom.get('y')).toBe(1)
  })

  it('o store só tem métodos', () => {
    provide('x', 1)
    for (const [k, v] of Object.entries(store())) expect(typeof v, k).toBe('function')
  })

  it('list mostra valor, dono, quem mudou e assinaturas', () => {
    provide('tema', 'claro', { writable: false })
    const off = shared('tema').subscribe(() => {})
    shared('livre').set(1)
    expect(entry('tema')).toEqual({ key: 'tema', value: 'claro', writable: false, owner: undefined, by: undefined, subscribers: 1 })
    off()
    expect(entry('tema')!.subscribers).toBe(0)
    expect(entry('livre')!.writable).toBe(true)
    // Chave só assinada, sem valor, não aparece.
    shared('nada').subscribe(() => {})
    expect(entry('nada')).toBeUndefined()
  })

  it('release só vale com o token do dono', () => {
    const s = createStore()
    const token = s.own('k', 1, false)!
    expect(s.own('k', 2, true)).toBeUndefined()
    s.release('k', {})
    expect(s.set('k', 3)).toBe(false)
    s.release('k', token)
    s.release('outra', token)
    expect(s.set('k', 3)).toBe(true)
    expect(s.get('k')).toBe(3)
  })
})

describe('SSR', () => {
  const script = (json: string) => {
    const el = document.createElement('script')
    el.type = 'application/json'
    el.setAttribute('data-vitral-shared', '')
    el.textContent = json
    document.head.appendChild(el)
  }

  it('hidrata o store com o <script data-vitral-shared>; o primeiro dono mantém o valor', () => {
    script('{"usuario":{"id":42},"tema":"escuro"}')
    expect(shared('usuario').get()).toEqual({ id: 42 })
    expect(provide('tema', 'claro').get()).toBe('escuro')
    expect(entry('tema')).toMatchObject({ value: 'escuro', writable: true })
  })

  it('JSON inválido não impede o store', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    script('{quebrado')
    expect(provide('x', 1).get()).toBe(1)
    expect(error).toHaveBeenCalled()
  })
})

describe('ctx.shared', () => {
  const ctxs: RemoteContext[] = []
  const remote = { mount: (_el: HTMLElement, _p: unknown, ctx: RemoteContext) => (ctxs.push(ctx), { unmount() {} }) }
  const mount = () => mountRemote(document.body.appendChild(document.createElement('div')), 'carrinho', {})

  it('cancela as assinaturas e solta as chaves do remote no unmount', async () => {
    provide('usuario', 'Ana')
    register('carrinho', { module: remote })
    const m = await mount()
    const ctx = ctxs.at(-1)!
    const seen: unknown[] = []
    ctx.shared!('usuario').subscribe((u) => seen.push(u))
    const off = ctx.shared!('usuario').subscribe(() => {})
    off()
    const itens = ctx.shared!.provide('itens', [1], { writable: false })
    expect(entry('itens')).toMatchObject({ owner: 'carrinho', by: 'carrinho', subscribers: 0 })
    expect(entry('usuario')!.subscribers).toBe(1)
    ctx.shared!.batch(() => itens.set([1, 2]))

    m.unmount()
    shared('usuario').set('Bia')
    expect(seen).toEqual(['Ana'])
    expect(store().list().reduce((n, e) => n + e.subscribers, 0)).toBe(0)
    // Sem dono, a chave volta a aceitar escrita e o valor fica.
    expect(entry('itens')).toMatchObject({ value: [1, 2], writable: true, owner: undefined })

    // Montado de novo, o remote volta a ser dono.
    await mount()
    ctxs.at(-1)!.shared!.provide('itens', [], { writable: false })
    expect(entry('itens')).toMatchObject({ value: [], writable: false, owner: 'carrinho' })
  })

  it('o erro de escrita traz o nome do remote', async () => {
    provide('tema', 'claro', { writable: false })
    register('carrinho', { module: remote })
    await mount()
    expect(() => ctxs.at(-1)!.shared!('tema').set('escuro')).toThrow(/\[vitral\] carrinho: só o dono altera "tema"/)
  })

  it('não vem quando esta cópia da lib nunca usou o store', async () => {
    vi.resetModules()
    const fresh = await import('../src/index')
    fresh.register('carrinho', { module: remote })
    await fresh.mountRemote(document.body.appendChild(document.createElement('div')), 'carrinho', {})
    expect(ctxs.at(-1)!.shared).toBeUndefined()
  })
})
