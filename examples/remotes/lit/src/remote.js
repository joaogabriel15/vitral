import { LitElement, html } from 'lit'
import { elementRemote } from 'arquipelago/element'

class LitCartao extends LitElement {
  static properties = { mensagem: {}, cliques: { state: true } }
  constructor() {
    super()
    this.mensagem = ''
    this.cliques = 0
  }
  // Light DOM: o host decide o isolamento (isolate="shadow"), não o componente.
  createRenderRoot() {
    return this
  }
  ping() {
    this.cliques++
    this.ilha.events.emit('ping', 'Lit')
  }
  render() {
    return html`<div class="cartao">
      <h3 class="fw">Lit</h3>
      <p class="msg">${this.mensagem}</p>
      <button class="ping" @click=${this.ping}>ping <span class="cliques">${this.cliques}</span></button>
    </div>`
  }
}

export default elementRemote('lit-cartao', () => customElements.get('lit-cartao') || customElements.define('lit-cartao', LitCartao))
