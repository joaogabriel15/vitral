// @vitest-environment happy-dom
// Língua dos textos da lib: configure({ language }), o lang da página ou o navegador.
import { afterEach, describe, expect, it } from 'vitest'
import { configure, loadRemote, messages } from '../src/index'
import { defineVitralElement } from '../src/element'
import { failingRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

defineVitralElement()
afterEach(() => {
  cleanup()
  document.documentElement.lang = 'pt-BR'
})

describe('língua', () => {
  it('página em inglês: interface e erros em inglês, com o link /en/erros/', async () => {
    document.documentElement.lang = 'en'
    expect(messages()).toEqual({ loading: 'Loading…', error: 'Could not load.', retry: 'Try again' })
    const e = await loadRemote('nao-existe').catch((e) => e)
    expect(e.message).toContain('remote not registered')
    expect(e.docs).toBe('https://joaogabriel15.github.io/vitral/en/erros/NOT_REGISTERED')
  })

  it('página em pt-BR: português, com o link /erros/', async () => {
    const e = await loadRemote('nao-existe').catch((e) => e)
    expect(e.message).toContain('remote não registrado')
    expect(e.docs).toBe('https://joaogabriel15.github.io/vitral/erros/NOT_REGISTERED')
  })

  it('configure({ language }) vence o lang da página', () => {
    document.documentElement.lang = 'pt-BR'
    configure({ language: 'en' })
    expect(messages().retry).toBe('Try again')
  })

  it('sem lang na página, vale a língua do navegador', () => {
    document.documentElement.lang = ''
    expect(messages().retry).toBe(/^pt/i.test(navigator.language) ? 'Tentar de novo' : 'Try again')
  })

  it('configure({ messages }) troca os textos do erro padrão', async () => {
    configure({ messages: { error: 'Ops.', retry: 'Recarregar' } })
    failingRemote('quebrado')
    document.body.innerHTML = '<vitral-remote name="quebrado"></vitral-remote>'
    await flush()
    const box = document.querySelector('[data-vitral-default="error"]')!
    expect(box.textContent).toBe('Ops. Recarregar')
  })
})
