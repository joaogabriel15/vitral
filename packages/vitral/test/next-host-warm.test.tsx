// @vitest-environment happy-dom
// Na página de um remote, o host começa o download das ofertas de `share` que
// o remote vai pedir quando o módulo é avaliado (antes da hidratação), e o
// pedido do remote reaproveita o mesmo download.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const modules = vi.hoisted(() => vi.fn(async () => ({ 'ui-kit': { Button: 'host' } })))
vi.mock('next/router', () => ({ default: { events: { on() {}, off() {} } }, useRouter: () => ({ asPath: '/loja', isReady: false }) }))
vi.mock('vitral-next-host-config', () => ({
  remotes: { loja: { url: '/loja-remote/vitral.json', basePath: '/loja', preload: false, hints: { manifest: '/loja-remote/vitral.json', css: [], js: [], offers: ['ui-kit'] } } },
  shared: { 'ui-kit': { version: '2.1.0', modules }, outro: { version: '1.0.0', modules: vi.fn() } },
  plan: {},
}))
vi.mock('../src/react', () => ({ preload: vi.fn(), Remote: () => null }))

it('aquece só as ofertas do remote da página, uma vez', async () => {
  history.replaceState(null, '', '/loja/x')
  const { NextRemote } = await import('../src/next-host')
  const { protocol } = await import('../src/core/state')
  const config = await import('vitral-next-host-config')
  expect(modules).toHaveBeenCalledTimes(1)
  expect((config.shared as any).outro.modules).not.toHaveBeenCalled()
  // O remote pede a oferta: o mesmo download, sem outro import().
  const el = document.createElement('div')
  await act(async () => createRoot(el).render(h(NextRemote, { name: 'loja' })))
  const got = await protocol().dedupe!('ui-kit', '^2.0.0', { version: '2.0.0', load: async () => ({}) })
  expect(got).toEqual({ 'ui-kit': { Button: 'host' } })
  expect(modules).toHaveBeenCalledTimes(1)
})
