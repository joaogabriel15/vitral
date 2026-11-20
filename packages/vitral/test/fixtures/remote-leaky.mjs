// Remote que deixa ouvintes e um setInterval depois do unmount (props.limpo limpa tudo).
export default {
  mount(el, props, ctx) {
    const onResize = () => {}
    const onKey = () => {}
    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', () => {}, { signal: ctx.signal })
    const id = setInterval(() => {}, 1000)
    el.textContent = 'leaky'
    return {
      unmount() {
        if (!props.limpo) return clearInterval(id)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('keydown', onKey, true)
        clearInterval(id)
      },
    }
  },
}
