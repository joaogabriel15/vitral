// Remote em TypeScript puro, sem framework.
import { component, html } from 'vitral'

export default component<{ mensagem?: string }>({
  state: { cliques: 0 },
  render: ({ mensagem }, state, ctx) => html`
    <div class="cartao">
      <h3 class="fw">Vanilla TS</h3>
      <p class="msg">${mensagem}</p>
      <button class="ping" onclick=${() => { state.cliques++; ctx.events.emit('ping', 'Vanilla TS') }}>
        ping <span class="cliques">${state.cliques}</span>
      </button>
    </div>
  `,
})
