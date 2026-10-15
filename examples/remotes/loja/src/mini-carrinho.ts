// Componente exposto: o host monta com name="loja/MiniCarrinho".
import { defineRemote } from 'vitral'
import { estado } from './estado'

export default defineRemote({
  mount(el, _props, ctx) {
    const draw = () => (el.innerHTML = `<p class="mini">itens: ${estado.itens}</p>`)
    draw()
    const off = ctx.events.on('loja:itens', draw)
    return { unmount: () => (off(), el.replaceChildren()) }
  },
})
