// Segunda versão do remote mínimo (testes de deploy novo com a aba aberta).
export default {
  mount(el, p, ctx) {
    el.textContent = `v2 ${ctx.name}`
    return { unmount() {} }
  },
}
