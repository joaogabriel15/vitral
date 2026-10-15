// Remote mínimo, sem build: o contrato é só um ES module com mount().
window.__execucoes = (window.__execucoes ?? 0) + 1

export default {
  mount(el, props, ctx) {
    const p = el.appendChild(document.createElement('p'))
    p.className = 'cartao'
    const render = (next) => (p.textContent = `${ctx.name}: ${next.texto ?? 'olá'}`)
    render(props)
    return { update: render, unmount: () => p.remove() }
  },
}
