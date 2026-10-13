// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { register } from '../src/index'
import { IlhaRemote, useIlha, vueRemote } from '../src/vue'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

afterEach(cleanup)

function mount(comp: any) {
  const div = document.body.appendChild(document.createElement('div'))
  const app = createApp(comp)
  app.mount(div)
  return { div, app }
}

describe('Vue: host <IlhaRemote>', () => {
  it('monta, mostra fallback e repassa props sem remontar', async () => {
    const m = mockRemote('a', (el, p) => (el.textContent = `n=${p.n}`))
    const n = ref(1)
    const { div } = mount({ render: () => h(IlhaRemote, { name: 'a', props: { n: n.value } }, { fallback: () => 'carregando' }) })
    expect(div.textContent).toBe('carregando')
    await flush()
    expect(div.textContent).toBe('n=1')
    n.value = 2
    await nextTick()
    await flush()
    expect(div.textContent).toBe('n=2')
    expect(m.mounts).toBe(1)
  })

  it('slot de erro com retry', async () => {
    failingRemote('b')
    const { div } = mount({
      render: () => h(IlhaRemote, { name: 'b' }, { error: ({ error, retry }: any) => h('button', { onClick: retry }, error.code) }),
    })
    await flush()
    expect(div.textContent).toBe('MOUNT_FAILED')
    mockRemote('b', (el) => (el.textContent = 'ok'))
    div.querySelector('button')!.click()
    await nextTick()
    await flush()
    expect(div.textContent).toBe('ok')
  })
})

describe('Vue: vueRemote', () => {
  it('renderiza, atualiza props, injeta o contexto e reporta erros', async () => {
    const Card = defineComponent({
      props: { msg: String, boom: Boolean },
      setup(props) {
        const ilha = useIlha()
        return () => {
          if (props.boom) throw new Error('boom')
          return h('p', `${props.msg} (${ilha?.name})`)
        }
      },
    })
    register('card', { module: vueRemote(Card) })
    const p = ref<any>({ msg: 'oi' })
    const { div } = mount({ render: () => h(IlhaRemote, { name: 'card', props: p.value }, { error: ({ error }: any) => h('b', error.code) }) })
    await flush()
    expect(div.textContent).toBe('oi (card)')
    p.value = { msg: 'tchau' }
    await nextTick()
    await flush()
    expect(div.textContent).toBe('tchau (card)')
    const orig = console.warn
    console.warn = () => {}
    p.value = { msg: 'x', boom: true }
    await nextTick()
    await flush()
    console.warn = orig
    expect(div.textContent).toBe('RENDER_FAILED')
  })
})
