// Host do vitral: só configure e createSlot (o host mínimo).
import { configure, createSlot } from 'vitral'
import { parametros, quandoMontar, remotes } from './lista.js'

const { n, base } = parametros()
const nomes = remotes(n)
const app = document.getElementById('app')
quandoMontar(app, n)
configure({ remotes: Object.fromEntries(nomes.map((nome) => [nome, `/${base}/${nome}/vitral.json`])) })
for (const nome of nomes) {
  createSlot(app.appendChild(document.createElement('section')), {
    name: nome,
    props: { nome, mensagem: 'olá' },
    onStatus: (s, e) => s === 'error' && (window.__erro = String(e)),
  })
}
