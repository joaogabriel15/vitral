// Remote com mount(): as props vêm do segundo parâmetro.
export default {
  mount(el: HTMLElement, props: { n: number; rotulo?: string }) {
    el.textContent = `${props.rotulo ?? ''}${props.n}`
    return { unmount: () => el.replaceChildren() }
  },
}
