// @vitest-environment happy-dom
// Contrato entre host e remote: o host recusa o remote antes de montar
// quando a versão do contrato ou uma dependência oferecida não serve.
import * as React from 'react'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configure, createSlot, mountRemote, register, type RemoteError, type RemoteManifest } from '../src/index'
import { Remote } from '../src/react'
import fixture from './fixtures/remote-src.mjs'
import { cleanup, flush, FIXTURE_REMOTE } from './helpers'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  cleanup()
  montagens.mockClear()
})

// O mesmo módulo que o loader importa: o espião vê se mount() rodou.
const montagens = vi.spyOn(fixture, 'mount')

function carrinho(contract?: RemoteManifest['contract'], host?: string) {
  configure({ allowedOrigins: ['*'] })
  register('carrinho', { url: 'https://cdn.empresa.com/carrinho/vitral.json', manifest: { name: 'carrinho', entry: FIXTURE_REMOTE, contract }, contract: host })
}

const box = () => document.body.appendChild(document.createElement('div'))
const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)

describe('contrato: versão', () => {
  it('versão na faixa do host: monta', async () => {
    carrinho({ version: '2.3.0' }, '^2')
    const el = box()
    await mountRemote(el, 'carrinho', {})
    expect(el.textContent).toBe('carrinho:')
    expect(montagens).toHaveBeenCalledTimes(1)
  })

  it('versão fora da faixa: CONTRACT_MISMATCH com remote, faixa e versão, sem chamar mount', async () => {
    carrinho({ version: '3.0.0' }, '^2')
    const el = box()
    const e = await fail(mountRemote(el, 'carrinho', {}))
    expect(e.code).toBe('CONTRACT_MISMATCH')
    expect(e.remote).toBe('carrinho')
    expect(e.message).toContain('[vitral] carrinho:')
    expect(e.message).toContain('^2')
    expect(e.message).toContain('3.0.0')
    expect(montagens).not.toHaveBeenCalled()
    expect(el.childElementCount).toBe(0)
  })

  it('a faixa de configure vale para todos; a da entrada vence', async () => {
    configure({ contract: '^1' })
    carrinho({ version: '2.0.0' })
    expect((await fail(mountRemote(box(), 'carrinho', {}))).code).toBe('CONTRACT_MISMATCH')
    carrinho({ version: '2.0.0' }, '^2')
    await mountRemote(box(), 'carrinho', {})
    expect(montagens).toHaveBeenCalledTimes(1)
  })

  it('sem contrato de um dos lados, não confere', async () => {
    carrinho({ version: '9.0.0' })
    await mountRemote(box(), 'carrinho', {})
    carrinho(undefined, '^2')
    await mountRemote(box(), 'carrinho', {})
    // Manifesto antigo sem `version` no contrato: só as dependências contam.
    carrinho({ peers: { react: '^19.0.0' } }, '^2')
    await mountRemote(box(), 'carrinho', {})
    expect(montagens).toHaveBeenCalledTimes(3)
  })
})

describe('contrato: dependências do host', () => {
  it('o host oferece a dependência fora da faixa do remote: recusa', async () => {
    configure({ dedupe: { react: { version: '18.3.1', modules: {} } } })
    carrinho({ peers: { react: '^19.0.0' } }, '*')
    const e = await fail(mountRemote(box(), 'carrinho', {}))
    expect(e.code).toBe('CONTRACT_MISMATCH')
    expect(e.message).toContain('react ^19.0.0')
    expect(e.message).toContain('18.3.1')
    expect(montagens).not.toHaveBeenCalled()
  })

  it('na faixa, ou sem oferta do host (o remote usa a própria cópia): monta', async () => {
    configure({ dedupe: { vue: { version: '3.5.2', modules: {} } } })
    carrinho({ peers: { vue: '^3.4.0', react: '^19.0.0' } }, '*')
    await mountRemote(box(), 'carrinho', {})
    expect(montagens).toHaveBeenCalledTimes(1)
  })
})

describe('contrato: interface de erro', () => {
  it('createSlot recebe o erro, e tentar de novo confere de novo', async () => {
    carrinho({ version: '3.0.0' }, '^2')
    const got: (string | undefined)[] = []
    const s = createSlot(box(), { name: 'carrinho', onStatus: (status, e) => got.push(e?.code ?? status) })
    await flush()
    expect(s.status).toBe('error')
    expect(got).toEqual(['loading', 'CONTRACT_MISMATCH'])
    carrinho({ version: '2.0.0' }, '^2')
    s.retry()
    await flush()
    expect(s.status).toBe('ready')
    s.destroy()
  })

  it('<Remote> mostra o error: o React da página não serve ao remote', async () => {
    carrinho({ peers: { react: `^${Number(React.version.split('.')[0]) + 1}.0.0` } }, '*')
    const div = box()
    const root = createRoot(div)
    await act(async () => root.render(h(Remote, { name: 'carrinho', fallback: h('i', null, 'carregando'), error: (e: RemoteError) => h('b', null, e.code) })))
    await act(() => flush())
    expect(div.textContent).toBe('CONTRACT_MISMATCH')
    expect(montagens).not.toHaveBeenCalled()
    act(() => root.unmount())
  })
})
