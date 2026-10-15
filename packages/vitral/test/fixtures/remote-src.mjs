// Remote mínimo para os testes de `src`: mostra ctx.name e a prop n.
export default {
  mount(el, p, ctx) {
    el.textContent = `${ctx.name}:${p.n ?? ''}`
    return { update: (n) => (el.textContent = `${ctx.name}:${n.n}`), unmount() {} }
  },
}
