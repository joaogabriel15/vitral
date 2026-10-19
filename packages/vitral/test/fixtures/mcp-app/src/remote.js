import './style.css'

// Remote de teste do MCP App: mostra a entrada e o resultado da tool e
// emite eventos nos botões.
function render(el, props) {
  const cidade = props.toolInput?.cidade ?? '…'
  const temp = props.toolResult?.structuredContent?.temperatura
  el.querySelector('.cidade').textContent = cidade
  el.querySelector('.temp').textContent = temp == null ? 'carregando' : `${temp} °C`
  el.querySelector('.tema').textContent = props.hostContext?.theme ?? ''
}

export default {
  async mount(el, props, ctx) {
    // import() dinâmico: o build tem que deixar tudo no mesmo arquivo.
    const { rotulo } = await import('./rotulo.js')
    el.innerHTML = `<div class="clima"><h1>${rotulo}</h1><p class="cidade"></p><p class="temp"></p><p class="tema"></p>
      <button class="favoritar">favoritar</button><button class="perguntar">perguntar</button><button class="abrir">abrir</button></div>`
    el.querySelector('.favoritar').onclick = () => ctx.events.emit('favorito', { cidade: props.toolInput?.cidade })
    el.querySelector('.perguntar').onclick = () => ctx.events.emit('mcp:message', 'Vai chover amanhã?')
    el.querySelector('.abrir').onclick = () => ctx.navigate('https://example.com/clima')
    render(el, props)
    return {
      update(next) {
        props = next
        render(el, next)
      },
      unmount: () => el.replaceChildren(),
    }
  },
}
