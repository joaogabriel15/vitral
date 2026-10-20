// Remote para isolate: 'reframe' (e2e/reframe.spec.ts). Usa globals de
// propósito: window, document, location, history e timers.
window.__global = 'remote'
const nasceu = location.href

export default {
  mount(el, props) {
    const box = document.createElement('div')
    box.className = 'reframe'
    box.innerHTML = '<p class="texto"></p><button class="botao" type="button">0</button><input class="campo"><p class="rota"></p><p class="tecla"></p>'
    el.appendChild(box)
    const render = (p) => (document.querySelector('.texto').textContent = p.texto ?? 'olá')
    render(props)
    // CSS posto no head do remote: fica no shadow root.
    const style = document.createElement('style')
    style.textContent = '.botao { color: rgb(0, 0, 255); }'
    document.head.appendChild(style)
    let n = 0
    const botao = document.getElementById('x') ?? document.querySelector('.botao')
    botao.addEventListener('click', () => (botao.textContent = String(++n)))
    const rota = () => (document.querySelector('.rota').textContent = location.pathname)
    rota()
    window.addEventListener('popstate', rota)
    // Timer e ouvinte que o remote esquece de limpar: somem com o iframe.
    const tecla = (e) => {
      parent.__teclas = (parent.__teclas ?? 0) + 1
      const p = document.querySelector('.tecla')
      if (p) p.textContent = e.key
    }
    document.addEventListener('keydown', tecla)
    setInterval(() => (parent.__ticks = (parent.__ticks ?? 0) + 1), 10)
    window.__info = { nasceu, mesmaOrigem: location.origin === parent.location.origin }
    window.__ir = (url) => {
      history.pushState({ de: 'remote' }, '', url)
      rota()
    }
    return {
      update: render,
      unmount() {
        el.textContent = ''
      },
    }
  },
}
