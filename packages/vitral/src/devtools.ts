/**
 * Painel de desenvolvimento: troca a URL de um remote por um `vite dev`
 * local sem mexer no código do host.
 *
 *   import { devtools } from 'vitral/devtools'
 *   if (import.meta.env.DEV) devtools()
 *
 * Os overrides ficam em `localStorage['vitral:overrides']` e só valem com
 * `configure({ devOverrides: true })` ou com a página em localhost.
 */
import { manifestUrl, OVERRIDES_KEY, overridesEnabled, storedOverrides } from './core/overrides'

/** Overrides salvos neste navegador: `{ nome: url }`. */
export function getOverrides(): Record<string, string> {
  return storedOverrides()
}

/** Salva (ou remove, com `null`) o override de um remote. Vale a partir do próximo carregamento. */
export function setOverride(name: string, url: string | null): void {
  const all = storedOverrides()
  if (url) all[name] = manifestUrl(url)
  else delete all[name]
  if (Object.keys(all).length) localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all))
  else localStorage.removeItem(OVERRIDES_KEY)
}

export interface DevtoolsOptions {
  /** Recarrega a página depois de mudar um override. Padrão: true. */
  reload?: boolean
}

const STYLE = `
:host { position: fixed; right: 12px; bottom: 12px; z-index: 2147483647; font: 13px/1.4 system-ui, sans-serif; color: #111 }
button { font: inherit; cursor: pointer }
.toggle { border: 1px solid #888; border-radius: 6px; background: #fff; padding: 4px 10px }
.panel { margin-bottom: 8px; padding: 10px; width: 320px; background: #fff; border: 1px solid #888; border-radius: 8px; box-shadow: 0 4px 16px #0003 }
ul { list-style: none; margin: 0 0 8px; padding: 0 }
li { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; word-break: break-all }
form { display: grid; gap: 4px }
input { font: inherit; padding: 3px 6px }
.aviso { color: #a40000; margin: 0 0 8px }
`

/** Mostra o painel no canto da página. Devolve uma função que o remove. */
export function devtools(options: DevtoolsOptions = {}): () => void {
  const host = document.createElement('div')
  host.setAttribute('data-vitral-devtools', '')
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLE
  const panel = document.createElement('div')
  panel.className = 'panel'
  panel.hidden = true
  const toggle = document.createElement('button')
  toggle.className = 'toggle'
  toggle.type = 'button'
  toggle.textContent = 'vitral'
  toggle.onclick = () => (panel.hidden = !panel.hidden)
  root.append(style, panel, toggle)

  const changed = () => (options.reload === false ? draw() : location.reload())

  function draw() {
    panel.replaceChildren()
    if (!overridesEnabled()) {
      const p = document.createElement('p')
      p.className = 'aviso'
      p.textContent = 'Overrides desligados: use configure({ devOverrides: true }) ou rode em localhost.'
      panel.append(p)
    }
    const list = document.createElement('ul')
    for (const [name, url] of Object.entries(storedOverrides())) {
      const item = document.createElement('li')
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.textContent = 'remover'
      remove.setAttribute('aria-label', `remover override de ${name}`)
      remove.onclick = () => (setOverride(name, null), changed())
      item.append(`${name} → ${url}`, remove)
      list.append(item)
    }
    const form = document.createElement('form')
    const name = Object.assign(document.createElement('input'), { placeholder: 'nome (ex.: carrinho)', required: true, name: 'name' })
    const url = Object.assign(document.createElement('input'), { placeholder: 'http://localhost:5174', required: true, name: 'url' })
    const save = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Salvar' })
    form.append(name, url, save)
    form.onsubmit = (e) => {
      e.preventDefault()
      setOverride(name.value.trim(), url.value.trim())
      changed()
    }
    panel.append(list, form)
  }

  draw()
  document.body.append(host)
  return () => host.remove()
}
