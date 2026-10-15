// Host sem framework: só o Web Component <vitral-remote>.
import { configure, events } from 'vitral'
import { defineVitralElement } from 'vitral/element'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']

configure({ remotes: '/remotes.json' })
defineVitralElement()

document.querySelector('#app')!.innerHTML = `
  <h1>Host JS/TS puro</h1>
  <input id="mensagem" aria-label="Mensagem" value="olá" />
  <p>Último ping: <span id="ultimo-ping">-</span></p>
  ${REMOTES.map((n) => `<section data-remote="${n}"><vitral-remote name="${n}" isolate="shadow"><p slot="fallback">carregando ${n}…</p></vitral-remote></section>`).join('')}
  <section data-remote="quebrado">
    <vitral-remote name="quebrado"><p slot="error" class="erro">indisponível <button>tentar de novo</button></p></vitral-remote>
  </section>
`

const input = document.querySelector<HTMLInputElement>('#mensagem')!
const sync = () => document.querySelectorAll('vitral-remote').forEach((el) => (el.props = { mensagem: input.value }))
input.addEventListener('input', sync)
sync()
document.querySelector('[data-remote=quebrado] button')!.addEventListener('click', () => document.querySelector<any>('[data-remote=quebrado] vitral-remote').retry())
events.on<string>('ping', (fw) => (document.querySelector('#ultimo-ping')!.textContent = fw))
