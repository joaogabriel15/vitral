// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, persist, provide, serializeShared, shared, syncTabs, type SharedValue } from '../src/index'

afterEach(() => {
  __reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

const tick = () => new Promise((r) => setTimeout(r, 20))

/** Uma "aba": um valor com o mesmo contrato do shared(), mas isolado. */
function tab<T>(key: string, value: T): SharedValue<T> {
  const subs = new Set<(v: T) => void>()
  const self: SharedValue<T> = {
    key,
    get: () => value,
    set(v) {
      value = v
      for (const fn of [...subs]) fn(v)
    },
    update: (fn) => self.set(fn(value)),
    subscribe(fn) {
      fn(value)
      subs.add(fn)
      return () => void subs.delete(fn)
    },
  }
  return self
}

describe('persist', () => {
  it('guarda cada mudança e restaura ao carregar, com chave versionada', () => {
    const carrinho = persist(provide('carrinho', [] as number[]))
    carrinho.set([1, 2])
    expect(localStorage.getItem('vitral:carrinho:1')).toBe('[1,2]')

    __reset()
    expect(persist(provide('carrinho', [] as number[])).get()).toEqual([1, 2])
    __reset()
    // Versão nova do formato ignora o valor antigo.
    expect(persist(provide('carrinho', [] as number[]), { version: 2 }).get()).toEqual([])
  })

  it('sessionStorage', () => {
    persist(provide('filtro', 'a'), { storage: 'session' }).set('b')
    expect(sessionStorage.getItem('vitral:filtro:1')).toBe('"b"')
    expect(localStorage.getItem('vitral:filtro:1')).toBeNull()
  })

  it('sem storage ou com JSON quebrado, segue sem persistir', () => {
    localStorage.setItem('vitral:x:1', '{quebrado')
    expect(persist(provide('x', 1)).get()).toBe(1)
    vi.stubGlobal('localStorage', undefined)
    expect(persist(provide('y', 1)).get()).toBe(1)
  })

  it('erro ao gravar vira aviso', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('cota')
    })
    persist(provide('x', 1)).set(2)
    expect(shared('x').get()).toBe(2)
    expect(warn).toHaveBeenCalled()
  })
})

describe('syncTabs', () => {
  it('espelha mudanças entre abas sem eco e sem sobrescrever ao abrir', async () => {
    const a = syncTabs(tab('carrinho', [1]))
    const b = syncTabs(tab('carrinho', [9]))
    await tick()
    expect(a.get()).toEqual([1])
    expect(b.get()).toEqual([9])
    const posted = vi.spyOn(BroadcastChannel.prototype, 'postMessage')
    a.set([1, 2])
    await tick()
    expect(b.get()).toEqual([1, 2])
    // b recebeu e não reenviou.
    expect(posted).toHaveBeenCalledTimes(1)
  })

  it('valor que não atravessa vira aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = syncTabs(tab<unknown>('fn', 1))
    a.set(() => {})
    expect(warn).toHaveBeenCalled()
  })

  it('sem BroadcastChannel, não faz nada', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const a = tab('x', 1)
    expect(syncTabs(a)).toBe(a)
  })
})

describe('serializeShared', () => {
  it('JSON seguro dentro de <script>, sem funções', () => {
    const json = serializeShared({ usuario: { nome: '</script><script>alert(1)</script>' }, auth: { getToken: () => 'x' }, f: () => 1 })
    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toEqual({ usuario: { nome: '</script><script>alert(1)</script>' }, auth: {} })
  })

  it('o cliente hidrata com o que o servidor serializou', () => {
    const el = document.createElement('script')
    el.type = 'application/json'
    el.setAttribute('data-vitral-shared', '')
    el.textContent = serializeShared({ usuario: { id: 42 } })
    document.head.appendChild(el)
    expect(shared('usuario').get()).toEqual({ id: 42 })
    el.remove()
  })
})
