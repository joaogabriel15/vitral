import { LitElement, html } from 'lit'
import 'vitral/auto'

class HostApp extends LitElement {
  render() {
    return html`<main>
      <h1>Host Lit</h1>
      <vitral-remote src="__SRC__" .props=${{ nome: 'host' }}></vitral-remote>
    </main>`
  }
}
customElements.define('host-app', HostApp)
document.getElementById('app').append(new HostApp())
