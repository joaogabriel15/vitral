import './remote.css'

// Remote em JS puro com Tailwind v4: cor da marca, dark mode, fonte própria,
// fonte importada de outra origem, gradiente (usa @property) e uma classe que
// só o CSS base do host define.
const html = `
  <button id="botao" class="bg-marca text-white px-4 py-2 rounded-lg">Comprar</button>
  <div id="tema" class="h-4 bg-white dark:bg-black"></div>
  <span id="fonte" class="font-remota">Aa</span>
  <span id="externa" class="font-externa">Aa</span>
  <span id="padrao">Aa</span>
  <div id="gradiente" class="h-4 bg-linear-to-r from-red-500 to-blue-500"></div>
  <p id="base" class="base-do-host">base</p>
`

export default {
  mount(el) {
    el.innerHTML = html
    return { unmount: () => el.replaceChildren() }
  },
}
