/**
 * Painel de desenvolvimento: troca a URL de um remote por um `vite dev`
 * local (ou pelo preview de um PR) sem mexer no código do host.
 *
 *   import { devtools } from 'vitral/devtools'
 *   if (import.meta.env.DEV) devtools()
 *
 * `watchLeaks()` avisa quando um remote sai da página e deixa ouvintes em
 * `window`/`document` ou `setInterval` abertos.
 *
 * O painel lista os overrides ativos: os de `?vitral=` desta aba e os
 * salvos em `localStorage['vitral:overrides']`. Só valem com
 * `configure({ devOverrides })` ou com a página em localhost.
 */
import { tr } from './core/lang'
import { mounted } from './core/errors'
import { ctxHooks } from './core/hooks'
import { activeOverrides, clearOverrides, dropOverride, overridesEnabled, storedOverrides, storeOverride } from './core/overrides'

export type { ActiveOverride } from './core/overrides'
export { activeOverrides, clearOverrides }

/** Overrides salvos neste navegador: `{ nome: url }`. */
export function getOverrides(): Record<string, string> {
  return storedOverrides()
}

/**
 * Salva no navegador o override de um remote: URL ou apelido (`pr-123`).
 * `null` remove o override (da aba e do navegador). Vale a partir do próximo
 * carregamento.
 */
export function setOverride(name: string, url: string | null): void {
  if (url) storeOverride(name, url)
  else dropOverride(name)
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
.ativo { background: #fde68a; border-color: #b45309 }
.limpar { margin-top: 8px }
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

  const changed = () => {
    // Os de `?vitral=` já estão na aba; sem o parâmetro, a remoção não volta no reload.
    const q = new URLSearchParams(location.search)
    if (q.has('vitral')) q.delete('vitral'), history.replaceState(history.state, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`)
    options.reload === false ? draw() : location.reload()
  }

  function draw() {
    panel.replaceChildren()
    const active = activeOverrides()
    toggle.textContent = active.length ? `vitral (${active.length})` : 'vitral'
    toggle.classList.toggle('ativo', active.length > 0)
    if (!overridesEnabled()) {
      const p = document.createElement('p')
      p.className = 'aviso'
      p.textContent = 'Overrides desligados: use configure({ devOverrides: true }) ou rode em localhost.'
      panel.append(p)
    }
    const list = document.createElement('ul')
    for (const { name, value, url, source } of active) {
      const item = document.createElement('li')
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.textContent = 'remover'
      remove.setAttribute('aria-label', `remover override de ${name}`)
      remove.onclick = () => (setOverride(name, null), changed())
      item.append(`${name} → ${url ?? `${value} (sem devOverrides.preview)`} [${source}]`, remove)
      list.append(item)
    }
    const form = document.createElement('form')
    const name = Object.assign(document.createElement('input'), { placeholder: 'nome (ex.: carrinho)', required: true, name: 'name' })
    const url = Object.assign(document.createElement('input'), { placeholder: 'http://localhost:5174 ou pr-123', required: true, name: 'url' })
    const save = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Salvar' })
    form.append(name, url, save)
    form.onsubmit = (e) => {
      e.preventDefault()
      setOverride(name.value.trim(), url.value.trim())
      changed()
    }
    panel.append(list, form)
    if (active.length) {
      const clear = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Limpar todos', className: 'limpar' })
      clear.onclick = () => (clearOverrides(), changed())
      panel.append(clear)
    }
  }

  draw()
  document.body.append(host)
  return () => host.remove()
}

// ---------------------------------------------------------------------------
// Vazamentos depois do unmount
// ---------------------------------------------------------------------------

/** O que um remote deixou para trás depois de sair da página. */
export interface LeakReport {
  /** Nome do remote. */
  name: string
  /** Ouvintes que ele pôs em `window` ou `document` e não tirou. */
  listeners: { target: 'window' | 'document'; type: string; stack?: string }[]
  /** `setInterval` que ele abriu e não fechou. */
  intervals: { stack?: string }[]
}

export interface LeakOptions {
  /** Espera depois do unmount antes de conferir, em ms (limpezas assíncronas). Padrão: 200. */
  delay?: number
  /** Recebe cada relatório. Padrão: um aviso no console. */
  onLeak?: (report: LeakReport) => void
}

interface Rec {
  name: string
  target: EventTarget
  type: string
  fn: unknown
  capture: boolean
  stack?: string
}

/** Remote montado dono do código no `stack`: o primeiro arquivo que mora na pasta de um remote. */
function ownerOf(stack: string | undefined): string | undefined {
  // URLs da pilha; no Node (testes), caminhos absolutos viram `file://`.
  const urls = stack?.match(/(?:https?|file):\/\/[^\s)'"]+|(?<=[\s(@])\/[^\s)'"]+/g)?.map((u) => (u[0] == '/' ? 'file://' + u : u))
  if (!urls) return
  // Pasta que também tem scripts do host (host e remote na mesma pasta) não serve para atribuir.
  const host = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel=modulepreload]')].map((el) => (el as HTMLScriptElement).src || (el as HTMLLinkElement).href)
  for (const url of urls) {
    let best: string | undefined
    let size = 0
    for (const [name, { entry }] of mounted) {
      const dir = new URL('.', entry).href
      if (dir.length > size && url.startsWith(dir) && !host.some((u) => u.startsWith(dir))) (best = name), (size = dir.length)
    }
    if (best) return best
  }
}

/**
 * Só em desenvolvimento: avisa quando um remote sai da página e deixa
 * ouvintes em `window`/`document` ou `setInterval` abertos (memória que cresce
 * a cada troca de tela). O dono é achado pela pilha da chamada, então o
 * remote precisa vir de uma URL (`vite dev` ou build sem SRI por `blob:`).
 * Devolve a função que desliga.
 *
 *   if (import.meta.env.DEV) watchLeaks()
 */
export function watchLeaks(options: LeakOptions = {}): () => void {
  // Quem guarda o `addEventListener` de `window` e de `document`: no navegador
  // é o EventTarget.prototype; em outros ambientes (happy-dom) pode ser outro.
  const owner = (t: object): EventTarget => {
    let o = t
    while (o && !Object.prototype.hasOwnProperty.call(o, 'addEventListener')) o = Object.getPrototypeOf(o)
    return (o ?? EventTarget.prototype) as EventTarget
  }
  const holders = [...new Set([owner(window), owner(document)])]
  const saved = holders.map((h) => [h.addEventListener, h.removeEventListener] as const)
  const set = globalThis.setInterval
  const clear = globalThis.clearInterval
  const recs = new Set<Rec>()
  const intervals = new Map<unknown, { name: string; stack?: string }>()
  const isGlobal = (t: EventTarget) => t === window || t === document
  const capture = (o: unknown) => (typeof o == 'object' ? !!(o as AddEventListenerOptions)?.capture : !!o)
  const find = (t: EventTarget, type: string, fn: unknown, c: boolean) => [...recs].find((r) => r.target === t && r.type === type && r.fn === fn && r.capture === c)

  const wrap = (add: EventTarget['addEventListener'], remove: EventTarget['removeEventListener']) => ({
    addEventListener(this: EventTarget, type: string, fn: any, o?: boolean | AddEventListenerOptions) {
      if (fn && isGlobal(this) && !find(this, type, fn, capture(o))) {
        const stack = new Error().stack
        const name = ownerOf(stack)
        const signal = typeof o == 'object' ? o.signal : undefined
        // `once` sai sozinho no primeiro disparo: fica de fora.
        if (name && !signal?.aborted && !(typeof o == 'object' && o.once)) {
          const r: Rec = { name, target: this, type, fn, capture: capture(o), stack }
          recs.add(r)
          signal?.addEventListener('abort', () => recs.delete(r))
        }
      }
      return add.call(this, type, fn, o)
    },
    removeEventListener(this: EventTarget, type: string, fn: any, o?: boolean | EventListenerOptions) {
      if (isGlobal(this)) {
        const r = find(this, type, fn, capture(o))
        if (r) recs.delete(r)
      }
      return remove.call(this, type, fn, o)
    },
  })
  holders.forEach((h, i) => Object.assign(h, wrap(...saved[i])))
  globalThis.setInterval = function (...a: Parameters<typeof setInterval>) {
    const id = set(...a)
    const stack = new Error().stack
    const name = ownerOf(stack)
    if (name) intervals.set(id, { name, stack })
    return id
  } as typeof setInterval
  globalThis.clearInterval = function (id?: Parameters<typeof clearInterval>[0]) {
    intervals.delete(id)
    return clear(id)
  } as typeof clearInterval

  const report =
    options.onLeak ??
    ((r: LeakReport) => {
      const what = [...r.listeners.map((l) => `${l.target}.${l.type}`), ...r.intervals.map(() => 'setInterval')]
      console.warn(`[vitral] ${r.name} ` + tr(`saiu da página e deixou ${what.length} ${what.length > 1 ? 'itens' : 'item'}: ${what.join(', ')}. Use ctx.signal ou limpe no unmount.`, `left the page and left ${what.length} ${what.length > 1 ? 'items' : 'item'} behind: ${what.join(', ')}. Use ctx.signal or clean up in unmount.`), r)
    })
  const before = ctxHooks.gone
  ctxHooks.gone = (name) => {
    before?.(name)
    setTimeout(() => {
      // Montado de novo nesse meio tempo: os ouvintes podem ser da montagem nova.
      if (mounted.has(name)) return
      const listeners = [...recs].filter((r) => r.name === name)
      const open = [...intervals].filter(([, i]) => i.name === name)
      for (const r of listeners) recs.delete(r)
      for (const [id] of open) intervals.delete(id)
      if (listeners.length || open.length)
        report({
          name,
          listeners: listeners.map((r) => ({ target: r.target === window ? 'window' : 'document', type: r.type, stack: r.stack })),
          intervals: open.map(([, i]) => ({ stack: i.stack })),
        })
    }, options.delay ?? 200)
  }
  return () => {
    holders.forEach((h, i) => Object.assign(h, { addEventListener: saved[i][0], removeEventListener: saved[i][1] }))
    globalThis.setInterval = set
    globalThis.clearInterval = clear
    ctxHooks.gone = before
  }
}
