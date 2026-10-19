// Host do Module Federation: runtime oficial, sem plugin de build. Os remotes
// são ES modules (`remoteEntry.js` do @module-federation/vite).
import { init, loadRemote } from '@module-federation/runtime'
import { parametros, quandoMontar, remotes } from './lista.js'

const { n, base } = parametros()
const nomes = remotes(n)
const app = document.getElementById('app')
quandoMontar(app, n)
init({
  name: 'host',
  remotes: nomes.map((nome) => ({ name: nome, entry: `/${base}/${nome}/remoteEntry.js`, type: 'module' })),
})
for (const nome of nomes) {
  const el = app.appendChild(document.createElement('section'))
  loadRemote(`${nome}/Cartao`).then(
    (m) => m.mount(el, { nome, mensagem: 'olá' }),
    (e) => (window.__erro = String(e)),
  )
}
