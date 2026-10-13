// @vitest-environment happy-dom
import '@angular/compiler' // JIT: compila o componente de teste em runtime
import { Component, Input } from '@angular/core'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { angularRemote, injectIlha } from '../src/angular'
import { defineIlhaElement } from '../src/element'
import { register } from '../src/index'
import { cleanup, flush } from './helpers'

beforeAll(() => defineIlhaElement())
afterEach(cleanup)

// Sem decorators de sintaxe (o esbuild do Vitest não emite metadados do Angular).
class Card {
  msg = ''
  ilha = injectIlha()
}
Input()(Card.prototype, 'msg')
Component({ selector: 'app-card', standalone: true, template: `<p>{{ msg }} ({{ ilha?.name }})</p>` })(Card)

describe('Angular: angularRemote', () => {
  it('monta o componente, repassa inputs, ignora props desconhecidas e desmonta', async () => {
    register('card', { module: angularRemote(Card) })
    document.body.innerHTML = `<ilha-remote name="card" props='{"msg":"oi","naoExiste":1}'></ilha-remote>`
    const el = document.querySelector('ilha-remote')!
    await flush(20)
    expect(el.textContent).toBe('oi (card)')
    el.props = { msg: 'tchau' }
    await flush()
    expect(el.textContent).toBe('tchau (card)')
    el.remove()
    await flush()
    expect(el.querySelector('app-card, p')).toBeNull()
  })
})
