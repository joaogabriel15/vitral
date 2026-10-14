// Host das baterias de rede, deploy e segurança. Os testes chamam
// window.vitral.configure() e window.montar() por page.evaluate.
import * as vitral from '/vitral/index.js'

window.vitral = vitral
window.slots = new Map()

let cliques = 0
const contador = document.querySelector('#contador')
contador.addEventListener('click', () => (contador.textContent = `cliques: ${++cliques}`))

/** Monta `name` num <section data-slot>, com o status (ou o código do erro) visível. */
window.montar = (name, { props, isolate } = {}) => {
  const section = document.createElement('section')
  section.dataset.slot = name
  const status = section.appendChild(document.createElement('p'))
  status.className = 'status'
  const alvo = section.appendChild(document.createElement('div'))
  document.querySelector('#slots').append(section)
  const slot = vitral.createSlot(alvo, {
    name,
    props,
    isolate,
    onStatus(s, error) {
      section.dataset.status = s
      status.textContent = error ? error.code : s
      if (error) section.dataset.erro = error.message
    },
  })
  window.slots.set(name, slot)
}

window.__pronto = true
