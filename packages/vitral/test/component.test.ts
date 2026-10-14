// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { component, createSlot, html, register, unsafeHTML, type RemoteModule } from '../src/index'
import { cleanup, flush } from './helpers'

afterEach(cleanup)

async function montar(remote: RemoteModule<any>, props: Record<string, unknown> = {}) {
  register('c', { module: remote })
  const target = document.createElement('div')
  document.body.append(target)
  const slot = createSlot(target, { name: 'c', props })
  await flush()
  return { target, slot }
}

describe('component() + html``', () => {
  it('renderiza props e atualiza quando o host muda as props', async () => {
    const { target, slot } = await montar(component<{ msg?: string }>(({ msg }) => html`<p>${msg}</p>`), { msg: 'oi' })
    expect(target.querySelector('p')!.textContent).toBe('oi')
    slot.update({ msg: 'tchau' })
    expect(target.querySelector('p')!.textContent).toBe('tchau')
  })

  it('escapa valores interpolados (sem XSS)', async () => {
    const { target } = await montar(component(({ msg }) => html`<p>${msg}</p>`), { msg: '<img src=x onerror=alert(1)>' })
    expect(target.querySelector('img')).toBeNull()
    expect(target.querySelector('p')!.textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('liga eventos on<evento>=${fn} e renderiza de novo quando o estado muda', async () => {
    const remote = component({
      state: { cliques: 0 },
      render: (_p, state) => html`<button onclick=${() => state.cliques++}>ping ${state.cliques}</button>`,
    })
    const { target } = await montar(remote)
    const botao = () => target.querySelector('button')!
    expect(botao().getAttributeNames().some((a) => a.startsWith('data-vitral-h'))).toBe(false)
    botao().click()
    await flush(1)
    expect(botao().textContent).toBe('ping 1')
    botao().click()
    await flush(1)
    expect(botao().textContent).toBe('ping 2')
  })

  it('aceita atributo de evento com aspas, listas e templates aninhados', async () => {
    let clicou = ''
    const item = (n: string) => html`<li onclick="${() => (clicou = n)}">${n}</li>`
    const { target } = await montar(component(() => html`<ul>${['a', 'b'].map(item)}</ul>${unsafeHTML('<b>ok</b>')}`))
    expect(target.querySelectorAll('li')).toHaveLength(2)
    expect(target.querySelector('b')!.textContent).toBe('ok')
    target.querySelectorAll('li')[1].click()
    expect(clicou).toBe('b')
  })

  it('chama a limpeza de mounted() no unmount', async () => {
    let limpou = false
    const { slot, target } = await montar(component({ render: () => 'x', mounted: () => () => (limpou = true) }))
    expect(target.textContent).toContain('x')
    slot.destroy()
    expect(limpou).toBe(true)
  })
})
