// Host sem framework: só o Web Component <ilha-remote>.
import { configure, events } from 'ilha'
import { defineIlhaElement } from 'ilha/element'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']

configure({ remotes: '/remotes.json' })
defineIlhaElement()

document.querySelector('#app')!.innerHTML = `
  <h1>Host JS/TS puro</h1>
  <input id="mensagem" value="olá" />
  <p>Último ping: <span id="ultimo-ping">-</span></p>
  ${REMOTES.map((n) => `<section data-remote="${n}"><ilha-remote name="${n}" isolate="shadow"><p slot="fallback">carregando ${n}…</p></ilha-remote></section>`).join('')}
  <section data-remote="quebrado">
    <ilha-remote name="quebrado"><p slot="error" class="erro">indisponível <button>tentar de novo</button></p></ilha-remote>
  </section>
`

const input = document.querySelector<HTMLInputElement>('#mensagem')!
const sync = () => document.querySelectorAll('ilha-remote').forEach((el) => (el.props = { mensagem: input.value }))
input.addEventListener('input', sync)
sync()
document.querySelector('[data-remote=quebrado] button')!.addEventListener('click', () => document.querySelector<any>('[data-remote=quebrado] ilha-remote').retry())
events.on<string>('ping', (fw) => (document.querySelector('#ultimo-ping')!.textContent = fw))
