// Remote inteiro (export default) da loja.
import { defineRemote } from 'vitral'
import { adicionar } from './api'
import { estado } from './estado'

export default defineRemote<{ titulo?: string }>({
  mount(el, props, ctx) {
    el.innerHTML = `<div class="loja"><h3 class="titulo"></h3><p class="total"></p><button class="comprar">comprar</button></div>`
    const draw = () => {
      el.querySelector('.titulo')!.textContent = props.titulo ?? 'Loja'
      el.querySelector('.total')!.textContent = `total: ${estado.itens}`
    }
    draw()
    el.querySelector('.comprar')!.addEventListener('click', () => adicionar())
    const off = ctx.events.on('loja:itens', draw)
    return {
      update(next) {
        props = next
        draw()
      },
      unmount: () => (off(), el.replaceChildren()),
    }
  },
})
