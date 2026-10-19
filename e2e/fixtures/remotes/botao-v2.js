// Remote com o próprio <ds-button>, versão 2, definido no registro do remote
// (ctx.customElements) sem checar se já existe. O botão entra por innerHTML.
class DsButton extends HTMLElement {
  connectedCallback() {
    this.textContent = 'ds-button v2'
  }
}

export default {
  mount(el, _props, ctx) {
    ;(ctx.customElements ?? customElements).define('ds-button', DsButton)
    el.innerHTML = '<ds-button></ds-button>'
    return { unmount: () => el.replaceChildren() }
  },
}
