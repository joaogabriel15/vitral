import './style.css'

export default {
  mount(el) {
    el.innerHTML = '<p class="cartao">oi</p>'
    return { unmount: () => el.replaceChildren() }
  },
}
