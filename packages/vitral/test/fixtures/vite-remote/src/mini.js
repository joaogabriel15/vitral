import { estado } from './estado.js'

export default {
  mount(el) {
    el.textContent = `itens: ${estado.itens}`
    return { unmount: () => el.replaceChildren() }
  },
}
