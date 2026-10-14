// Entrada achada sem `entry`: objeto com mount, usado como está.
export default {
  mount(el, props) {
    el.textContent = `oi ${props.nome}`
    return { unmount: () => el.replaceChildren() }
  },
}
