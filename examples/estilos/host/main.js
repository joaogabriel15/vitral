// Host mínimo para o e2e de estilos. Parâmetros da URL:
// ?remote=padrao|opcoes  ?isolate=shadow  ?mirror=0  ?base  ?dark
import { configure, createSlot } from 'vitral'

const q = new URLSearchParams(location.search)
if (q.has('dark')) document.documentElement.classList.add('dark')

configure({
  remotes: { loja: `http://localhost:4310/${q.get('remote') ?? 'opcoes'}/vitral.json` },
  styles: { mirrorTheme: q.get('mirror') !== '0', inherit: q.has('base') ? ['/base.css'] : [] },
})

createSlot(document.getElementById('remote'), {
  name: 'loja',
  isolate: q.get('isolate') === 'shadow' ? 'shadow' : 'none',
  onStatus: (status) => document.body.setAttribute('data-status', status),
})
