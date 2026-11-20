// Remote que guarda o ctx em globalThis.__ctx (testes que precisam chamar ctx.reportError).
export default {
  mount(el, p, ctx) {
    globalThis.__ctx = ctx
    el.textContent = `v1 ${ctx.name}`
    return { unmount() {} }
  },
}
