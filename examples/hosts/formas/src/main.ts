// Host sem framework com os recursos opcionais: partes de um remote,
// módulo sem UI, rotas, iframe e atualização sem reload.
import { configure, events, loadModule, refresh, watchUpdates } from 'vitral'
import { defineVitralElement, type VitralRemoteElement } from 'vitral/element'
import { enableIframe } from 'vitral/iframe'
import { routes } from 'vitral/routes'

configure({ remotes: '/remotes.json' })
defineVitralElement()
enableIframe()
routes({ '/rotas/loja/*': 'loja', '/rotas/conta': 'vanilla' })
watchUpdates()

document.querySelector('#app')!.innerHTML = `
  <h1>Host formas de usar</h1>

  <section id="partes">
    <h2>Partes de um remote</h2>
    <vitral-remote name="loja/MiniCarrinho"></vitral-remote>
    <button id="adicionar">adicionar pela api</button>
    <p>itens pela api: <span id="itens-api">-</span></p>
  </section>

  <section id="rotas">
    <h2>Rotas</h2>
    <nav><a href="/rotas/loja">loja</a> <a href="/rotas/conta">conta</a> <a href="/">início</a></nav>
    <vitral-outlet props='{"titulo":"Loja na rota","mensagem":"olá"}'>
      <p slot="fallback">carregando…</p>
      <p slot="empty" class="vazio">nenhuma rota</p>
    </vitral-outlet>
  </section>

  <section id="parceiro">
    <h2>Iframe</h2>
    <input id="mensagem" value="olá" />
    <vitral-remote name="intruso" props='{"mensagem":"olá"}'></vitral-remote>
    <p>documento visto pelo iframe: <span id="intruso-documento">-</span></p>
    <p>último ping: <span id="ultimo-ping">-</span></p>
  </section>

  <section id="atualizacoes">
    <h2>Atualização sem reload</h2>
    <p>versão nova: <span id="atualizacao">-</span></p>
    <button id="atualizar">atualizar</button>
  </section>
`

type Api = { adicionar(): number }
document.querySelector('#adicionar')!.addEventListener('click', async () => {
  const api = await loadModule<Api>('loja/api')
  document.querySelector('#itens-api')!.textContent = String(api.adicionar())
})

const input = document.querySelector<HTMLInputElement>('#mensagem')!
input.addEventListener('input', () => (document.querySelector<VitralRemoteElement>('vitral-remote[name=intruso]')!.props = { mensagem: input.value }))
events.on<string>('intruso:documento', (v) => (document.querySelector('#intruso-documento')!.textContent = v))
events.on<string>('ping', (v) => (document.querySelector('#ultimo-ping')!.textContent = v))

let pendentes: string[] = []
events.on<{ name: string }>('vitral:update-available', ({ name }) => {
  pendentes.push(name)
  document.querySelector('#atualizacao')!.textContent = pendentes.join(', ')
})
document.querySelector('#atualizar')!.addEventListener('click', async () => {
  const nomes = pendentes
  pendentes = []
  await Promise.all(nomes.map((n) => refresh(n)))
  document.querySelector('#atualizacao')!.textContent = 'atualizado'
})
