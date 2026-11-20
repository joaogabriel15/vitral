// @vitest-environment happy-dom
// `waitFor`: o remote só monta quando as chaves de `provide` têm valor.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hostSlot } from '../src/core/host-slot'
import { defineVitralElement } from '../src/element'
import { provide, register, shared } from '../src/index'
import { cleanup, flush } from './helpers'

afterEach(cleanup)

function remote() {
  const mount = vi.fn((el: HTMLElement, props: { n?: number }) => ((el.textContent = `montado ${props.n ?? ''}`), { unmount: vi.fn() }))
  register('conta', { module: { mount } })
  return mount
}

describe('waitFor', () => {
  it('espera a chave ter valor; null não conta', async () => {
    const mount = remote()
    const sessao = provide<{ id: number } | null>('sessao', null)
    const el = document.body.appendChild(document.createElement('div'))
    const status = vi.fn()
    hostSlot(el, { name: 'conta', waitFor: 'sessao', onStatus: status })
    await flush()
    expect(mount).not.toHaveBeenCalled()
    sessao.set({ id: 1 })
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1))
    expect(status).toHaveBeenLastCalledWith('ready', null)
  })

  it('várias chaves: monta só quando todas existem, com as props atuais', async () => {
    const mount = remote()
    const el = document.body.appendChild(document.createElement('div'))
    const slot = hostSlot<{ n?: number }>(el, { name: 'conta', waitFor: ['sessao', 'tema'] })
    shared('sessao').set({ id: 1 })
    await flush()
    expect(mount).not.toHaveBeenCalled()
    slot.update({ n: 2 })
    shared('tema').set('escuro')
    await vi.waitFor(() => expect(el.textContent).toBe('montado 2'))
  })

  it('chave que já tem valor: monta direto', async () => {
    const mount = remote()
    provide('sessao', { id: 1 })
    const el = document.body.appendChild(document.createElement('div'))
    hostSlot(el, { name: 'conta', waitFor: 'sessao' })
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1))
  })

  it('destruído enquanto espera: nunca monta', async () => {
    const mount = remote()
    const el = document.body.appendChild(document.createElement('div'))
    const slot = hostSlot(el, { name: 'conta', waitFor: 'sessao' })
    await flush()
    slot.destroy()
    shared('sessao').set({ id: 1 })
    await flush()
    expect(mount).not.toHaveBeenCalled()
  })

  it('<vitral-remote wait-for>', async () => {
    const mount = remote()
    defineVitralElement()
    document.body.innerHTML = '<vitral-remote name="conta" wait-for="sessao, tema"></vitral-remote>'
    shared('sessao').set({ id: 1 })
    await flush()
    expect(mount).not.toHaveBeenCalled()
    shared('tema').set('claro')
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1))
  })
})
