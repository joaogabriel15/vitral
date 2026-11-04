/**
 * Visita de volta com a última tela do remote: ao sair, o HTML que o remote
 * mostrava fica guardado; ao voltar, ele aparece na hora, inerte, enquanto o
 * JS baixa, e sai quando o remote monta. A ideia é a do Fawkes (NSDI'20):
 * quase todo o HTML de uma página não muda entre visitas.
 *
 * Fica num módulo à parte, baixado só por quem usa `snapshot`. Guarda no
 * `sessionStorage` (some ao fechar a aba): o HTML pode ter dados do usuário.
 * Só sem Shadow DOM.
 */
import type { SlotStatus } from './slot'
import { protocol, type LoadedRemote } from './state'

const KEY = 'vitral:snap:'
/** Tamanho máximo do HTML guardado por remote. */
const MAX = 100_000

interface Snap {
  html: string
  /** `[href, integrity]` do CSS do remote, para a tela não aparecer sem estilo. */
  css: [string, string?][]
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

function keyOf(name: string, props: unknown): string | null {
  try {
    return KEY + name + ':' + hash(JSON.stringify(props ?? {}))
  } catch {
    // Props com ciclo ou função: sem chave estável, sem snapshot.
    return null
  }
}

function store(): Storage | null {
  try {
    return sessionStorage
  } catch {
    return null
  }
}

/** O snapshot guardado para estas props, ou `null`. */
export function read(name: string, props: unknown): Snap | null {
  const k = keyOf(name, props)
  try {
    const raw = k && store()?.getItem(k)
    const s = raw ? (JSON.parse(raw) as Snap) : null
    return typeof s?.html === 'string' && Array.isArray(s.css) ? s : null
  } catch {
    return null
  }
}

/** Mostra o snapshot em `target`. Devolve a função que o tira. */
export function show(target: HTMLElement, snap: Snap): () => void {
  for (const [href, integrity] of snap.css)
    if (!document.querySelector(`link[rel=stylesheet][href="${CSS.escape(href)}"]`)) {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      l.crossOrigin = 'anonymous'
      if (integrity) l.integrity = integrity
      document.head.append(l)
    }
  const box = document.createElement('div')
  box.setAttribute('data-vitral-snapshot', '')
  box.setAttribute('aria-hidden', 'true')
  box.inert = true
  box.style.display = 'contents'
  box.append(clean(snap.html))
  target.prepend(box)
  return () => box.remove()
}

/** O HTML sem nada que rode ou carregue outra página. */
function clean(html: string): DocumentFragment {
  const t = document.createElement('template')
  t.innerHTML = html
  for (const el of t.content.querySelectorAll('script,iframe,object,embed,frame,[data-vitral-snapshot]')) el.remove()
  for (const el of t.content.querySelectorAll('*')) for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name)
  return t.content
}

/** O CSS do remote já carregado, para guardar junto. */
export async function cssOf(name: string): Promise<Snap['css']> {
  try {
    const r: LoadedRemote = await protocol().load(name, () => Promise.reject(new Error('não carregado')))
    return r.isolate === 'shadow' ? [] : r.css.map((href) => [href, r.sri?.[href]])
  } catch {
    return []
  }
}

/** Guarda o que o remote mostra em `box` agora. */
export function save(name: string, props: unknown, box: HTMLElement, css: Snap['css']): void {
  const k = keyOf(name, props)
  // Com Shadow DOM a raiz fica dentro do shadow root e não aparece aqui.
  const root = box.querySelector(':scope>[data-vitral-slot]>[data-vitral-root]')
  if (!k || !root) return
  const html = root.outerHTML
  const s = store()
  try {
    if (html.length > MAX) s?.removeItem(k)
    else s?.setItem(k, JSON.stringify({ html, css } satisfies Snap))
  } catch {
    // Cota cheia: fica sem snapshot.
  }
}

/**
 * Liga o snapshot a um `hostSlot`: mostra o guardado agora e devolve a função
 * que recebe cada status (sem status: o slot saiu, e a tela é guardada).
 */
export function attach(target: HTMLElement, name: string, props: () => unknown, box: () => HTMLElement | undefined, onSnapshot?: (shown: boolean) => void): (status?: SlotStatus) => void {
  let ready = false
  let css: Snap['css'] = []
  let hide = () => {}
  const found = read(name, props())
  if (found) {
    const off = show(target, found)
    onSnapshot?.(true)
    hide = () => (off(), onSnapshot?.(false), (hide = () => {}))
  }
  const keep = () => {
    const b = box()
    if (ready && b) save(name, props(), b, css)
  }
  addEventListener('pagehide', keep)
  return (status) => {
    if (status === undefined) return keep(), removeEventListener('pagehide', keep), hide()
    if (status !== 'loading') hide()
    ready = status === 'ready'
    if (ready) cssOf(name).then((c) => (css = c))
  }
}
