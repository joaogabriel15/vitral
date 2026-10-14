import { LitElement, html } from 'lit'

// O plugin vitral registra a tag e embrulha a classe: não precisa de adaptador.
export default class App extends LitElement {
  static properties = { nome: {}, cliques: { state: true } }

  constructor() {
    super()
    this.nome = 'mundo'
    this.cliques = 0
  }

  render() {
    return html`<section>
      <h2>Olá, ${this.nome}</h2>
      <button @click=${() => this.cliques++}>Cliques: ${this.cliques}</button>
    </section>`
  }
}
