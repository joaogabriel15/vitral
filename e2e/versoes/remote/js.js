// Remote em JS puro. A lib que entra no bundle é a da versão do build.
import { defineRemote, events, mountRemote } from 'vitral'
import './remote.css'

export default defineRemote({
  mount(el, props, ctx) {
    el.innerHTML = `
      <div class="remote">
        <p class="texto"></p>
        <p class="recebido">-</p>
        <button class="emitir">emitir</button>
        <button class="emitir-direto">emitir direto</button>
        <button class="aninhar">aninhar</button>
        <p class="aninhado-status">-</p>
        <div class="aninhado"></div>
      </div>`
    const $ = (s) => el.querySelector(s)
    const render = (p) => ($('.texto').textContent = p.texto)
    render(props)

    // Contrato: eventos pelo ctx, que é o barramento do host.
    ctx.events.on('host:diz', (v) => {
      window.__recebidos = (window.__recebidos ?? 0) + 1
      $('.recebido').textContent = v
    })
    $('.emitir').onclick = () => ctx.events.emit('remote:diz', ctx.name)

    // Protocolo: a cópia da lib do bundle fala com a do host por Symbol.for('vitral').
    $('.emitir-direto').onclick = () => events.emit('remote:direto', ctx.name)
    let filho = null
    $('.aninhar').onclick = () =>
      mountRemote($('.aninhado'), 'filho', { texto: 'aninhado' }).then(
        (h) => ((filho = h), ($('.aninhado-status').textContent = 'ready')),
        (e) => ($('.aninhado-status').textContent = e.code),
      )

    return {
      update: render,
      unmount() {
        filho?.unmount()
        el.textContent = ''
      },
    }
  },
})
