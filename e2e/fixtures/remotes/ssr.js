// Remote com SSR: `render` roda no gateway (Node), `hydrate` assume o HTML no navegador.
const contador = (n) => `<button class="ssr" type="button">itens: ${n}</button>`

export function render(props) {
  return contador(props.n ?? 0)
}

function ligar(el, props) {
  const button = el.querySelector('button')
  let n = props.n ?? 0
  button.onclick = () => (button.textContent = `itens: ${++n}`)
  return {
    update(next) {
      n = next.n ?? 0
      button.textContent = `itens: ${n}`
    },
    unmount: () => (el.textContent = ''),
  }
}

export default {
  mount(el, props) {
    globalThis.__chamadas = [...(globalThis.__chamadas ?? []), 'mount']
    el.innerHTML = contador(props.n ?? 0)
    return ligar(el, props)
  },
  hydrate(el, props) {
    globalThis.__chamadas = [...(globalThis.__chamadas ?? []), 'hydrate']
    return ligar(el, props)
  },
}
