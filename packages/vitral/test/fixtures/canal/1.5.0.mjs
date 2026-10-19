// Versão 1.5.0 de um remote publicado num canal (testes de canary e rollback): mostra a versão e guarda o ctx.
export default {
  mount(el, _p, ctx) {
    ;(globalThis.__vitralCtx ??= []).push(ctx)
    el.textContent = '1.5.0'
    return { unmount() {} }
  },
}
