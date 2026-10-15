// @vitest-environment happy-dom
// Hooks de cada framework para o contexto compartilhado: valor inicial,
// re-render só quando o valor (ou o seletor) muda e nenhuma assinatura
// sobrando depois de desmontar.
import '@angular/compiler'
import { Component } from '@angular/core'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { h as ph, render as preactRender } from 'preact'
import { act as preactAct } from 'preact/test-utils'
import { createEffect, createRoot as solidRoot } from 'solid-js'
import { createApp, defineComponent, effectScope, h as vh, nextTick } from 'vue'
import { flushSync, mount as svelteMount, unmount as svelteUnmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { provide, register, type ProvidedValue } from '../src/index'
import { protocol } from '../src/core/state'
import { useShared as useReact } from '../src/react'
import { useShared as usePreact } from '../src/preact'
import { useShared as useVue } from '../src/vue'
import { useShared as useSolid } from '../src/solid'
import { angularRemote, injectShared } from '../src/angular'
import { defineVitralElement, SharedController } from '../src/element'
import Tema from './fixtures/Tema.svelte'
import { cleanup, flush } from './helpers'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

interface Usuario {
  nome: string
  idade: number
}

const subscribers = () => protocol().shared!().list().reduce((n, e) => n + e.subscribers, 0)
let usuario: ProvidedValue<Usuario>
const start = () => (usuario = provide<Usuario>('usuario', { nome: 'Ana', idade: 30 }))
const aniversario = () => usuario.update((u) => ({ ...u, idade: u.idade + 1 }))
const renomear = (nome: string) => usuario.update((u) => ({ ...u, nome }))

describe('React: useShared', () => {
  it('com seletor, só re-renderiza quando o resultado muda', async () => {
    start()
    let renders = 0
    function Nome() {
      renders++
      return createElement('p', null, useReact<Usuario, string | undefined>('usuario', (u) => u?.nome))
    }
    function Idade() {
      return createElement('p', null, useReact<Usuario>('usuario')?.idade)
    }
    const div = document.body.appendChild(document.createElement('div'))
    const root = createRoot(div)
    await act(async () => root.render([createElement(Nome, { key: 1 }), createElement(Idade, { key: 2 })]))
    expect(div.textContent).toBe('Ana30')
    const before = renders
    await act(async () => aniversario())
    expect(div.textContent).toBe('Ana31')
    expect(renders).toBe(before)
    await act(async () => renomear('Bia'))
    expect(div.textContent).toBe('Bia31')
    expect(renders).toBe(before + 1)
    await act(async () => root.unmount())
    expect(subscribers()).toBe(0)
  })

  it('seletor que cria objeto não entra em loop', async () => {
    start()
    let renders = 0
    function Card() {
      renders++
      const v = useReact<Usuario, { n?: string }>('usuario', (u) => ({ n: u?.nome }))
      return createElement('p', null, v.n)
    }
    const div = document.body.appendChild(document.createElement('div'))
    const root = createRoot(div)
    await act(async () => root.render(createElement(Card)))
    expect(div.textContent).toBe('Ana')
    expect(renders).toBeLessThan(4)
    await act(async () => root.unmount())
  })
})

describe('Preact: useShared', () => {
  it('re-renderiza quando o seletor muda e solta a assinatura', async () => {
    start()
    let renders = 0
    function Nome() {
      renders++
      return ph('p', null, usePreact<Usuario, string | undefined>('usuario', (u) => u?.nome))
    }
    const div = document.body.appendChild(document.createElement('div'))
    await preactAct(() => preactRender(ph(Nome, null), div))
    expect(div.textContent).toBe('Ana')
    const before = renders
    await preactAct(() => aniversario())
    expect(renders).toBe(before)
    await preactAct(() => renomear('Bia'))
    expect(div.textContent).toBe('Bia')
    await preactAct(() => preactRender(null, div))
    expect(subscribers()).toBe(0)
  })
})

describe('Vue: useShared', () => {
  it('ref que escreve, ref com seletor e limpeza no unmount', async () => {
    start()
    provide('tema', 'claro')
    let renders = 0
    const Card = defineComponent({
      setup() {
        const tema = useVue<string>('tema')
        const nome = useVue<Usuario, string | undefined>('usuario', (u) => u?.nome)
        return () => {
          renders++
          return vh('button', { onClick: () => (tema.value = 'escuro') }, `${nome.value} ${tema.value}`)
        }
      },
    })
    const div = document.body.appendChild(document.createElement('div'))
    const app = createApp(Card)
    app.mount(div)
    expect(div.textContent).toBe('Ana claro')
    div.querySelector('button')!.click()
    await nextTick()
    expect(div.textContent).toBe('Ana escuro')
    const before = renders
    aniversario()
    await nextTick()
    expect(renders).toBe(before)
    app.unmount()
    expect(subscribers()).toBe(0)
  })

  it('fora de componente, num effectScope, solta ao parar o scope', () => {
    start()
    const scope = effectScope()
    const nome = scope.run(() => useVue<Usuario, string | undefined>('usuario', (u) => u?.nome))!
    renomear('Bia')
    expect(nome.value).toBe('Bia')
    scope.stop()
    expect(subscribers()).toBe(0)
  })
})

describe('Solid: useShared', () => {
  it('accessor que só muda quando o seletor muda', () => {
    start()
    let runs = 0
    const { nome, dispose } = solidRoot((dispose) => {
      const nome = useSolid<Usuario, string | undefined>('usuario', (u) => u?.nome)
      createEffect(() => (nome(), runs++))
      return { nome, dispose }
    })
    expect(nome()).toBe('Ana')
    expect(runs).toBe(1)
    renomear('Bia')
    expect(nome()).toBe('Bia')
    expect(runs).toBe(2)
    aniversario()
    expect(runs).toBe(2)
    dispose()
    expect(subscribers()).toBe(0)
  })
})

describe('Svelte: shared() segue o contrato de store', () => {
  it('$tema lê e reage, set escreve', () => {
    provide('tema', 'claro')
    const div = document.body.appendChild(document.createElement('div'))
    const app = svelteMount(Tema, { target: div })
    flushSync()
    expect(div.querySelector('p')!.textContent).toBe('claro')
    div.querySelector('button')!.click()
    flushSync()
    expect(div.querySelector('p')!.textContent).toBe('escuro')
    svelteUnmount(app)
    expect(subscribers()).toBe(0)
  })
})

describe('Angular: injectShared', () => {
  it('Signal com seletor dentro de um remote; solta no destroy', async () => {
    start()
    class Nome {
      nome = injectShared<Usuario, string | undefined>('usuario', (u) => u?.nome)
    }
    Component({ selector: 'app-nome', standalone: true, template: `<p>{{ nome() }}</p>` })(Nome)
    defineVitralElement()
    register('nome', { module: angularRemote(Nome) })
    document.body.innerHTML = `<vitral-remote name="nome"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await flush(20)
    expect(el.textContent).toBe('Ana')
    renomear('Bia')
    await flush()
    expect(el.textContent).toBe('Bia')
    el.remove()
    await flush()
    expect(subscribers()).toBe(0)
  })

  it('fora de um contexto de injeção é erro do Angular', () => {
    expect(() => injectShared('usuario')).toThrow()
  })
})

describe('Lit: SharedController', () => {
  it('assina conectado, pede render quando muda e solta desconectado', () => {
    start()
    const controllers: any[] = []
    let updates = 0
    const host = { addController: (c: any) => controllers.push(c), requestUpdate: () => updates++ }
    const nome = new SharedController<Usuario, string | undefined>(host, 'usuario', (u) => u?.nome)
    const todo = new SharedController<Usuario>(host, 'usuario')
    expect(controllers).toEqual([nome, todo])
    expect(nome.value).toBe('Ana')
    nome.hostConnected()
    aniversario()
    expect(updates).toBe(0)
    renomear('Bia')
    expect(nome.value).toBe('Bia')
    expect(updates).toBe(1)
    nome.hostDisconnected()
    todo.hostDisconnected()
    expect(subscribers()).toBe(0)
    expect(todo.value).toEqual({ nome: 'Ana', idade: 30 })
  })
})
