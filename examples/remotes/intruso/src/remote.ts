// Remote "de terceiro" que tenta mexer na página. No host ele roda com
// isolate="iframe": nenhuma dessas tentativas pode funcionar.
import { defineRemote } from 'vitral'

function tenta(fn: () => unknown): string {
  try {
    return String(fn())
  } catch {
    return 'bloqueado'
  }
}

export default defineRemote<{ mensagem?: string }>({
  mount(el, props, ctx) {
    const documento = tenta(() => window.parent.document.title)
    const storage = tenta(() => localStorage.getItem('vitral') ?? 'livre')
    // Sujar o window: no iframe isso fica no window do próprio iframe.
    ;(window as unknown as Record<string, unknown>).__intruso = true
    el.innerHTML = `
      <div class="intruso">
        <p class="documento">${documento}</p>
        <p class="storage">${storage}</p>
        <p class="msg"></p>
        <button class="ping">ping</button>
        <button class="fora">sair do site</button>
      </div>`
    const msg = el.querySelector('.msg')!
    msg.textContent = props.mensagem ?? ''
    el.querySelector('.ping')!.addEventListener('click', () => ctx.events.emit('ping', 'Intruso'))
    el.querySelector('.fora')!.addEventListener('click', () => ctx.navigate('https://exemplo.com/'))
    ctx.events.emit('intruso:documento', documento)
    return {
      update: (next) => (msg.textContent = next.mensagem ?? ''),
      unmount: () => el.replaceChildren(),
    }
  },
})
