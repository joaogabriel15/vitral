// Remote em TypeScript puro, sem framework: só implementar mount/update/unmount.
import { defineRemote } from 'ilha'

interface Props extends Record<string, unknown> {
  mensagem?: string
}

export default defineRemote<Props>({
  mount(el, props, ctx) {
    let cliques = 0
    el.innerHTML = `<div class="cartao">
      <h3 class="fw">Vanilla TS</h3>
      <p class="msg"></p>
      <button class="ping">ping <span class="cliques">0</span></button>
    </div>`
    const msg = el.querySelector<HTMLParagraphElement>('.msg')!
    const contador = el.querySelector<HTMLSpanElement>('.cliques')!
    const onClick = () => {
      contador.textContent = String(++cliques)
      ctx.events.emit('ping', 'Vanilla TS')
    }
    el.querySelector('button')!.addEventListener('click', onClick)
    const render = (p: Props) => (msg.textContent = p.mensagem ?? '')
    render(props)
    return {
      update: render,
      unmount: () => el.replaceChildren(),
    }
  },
})
