import './style.css'
import { titulo } from './comum.js'

export default {
  async mount(el) {
    el.textContent = titulo('carregando')
    const { desenhar } = await import('./grafico.js')
    desenhar(el)
    return { unmount: () => el.replaceChildren() }
  },
}
