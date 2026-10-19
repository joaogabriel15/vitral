/**
 * Loader de uma linha para widget em site de terceiros, sem bundler:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js"
 *     data-remote="https://cdn.empresa.com/chat/stable/vitral.json"
 *     data-target="#chat" data-props='{"lang":"pt"}' async></script>
 *
 * Sai num arquivo só (IIFE, sem chunks), para `<script>` clássico com
 * `async` ou `defer`. Cada tag monta um `<vitral-remote>` dentro de
 * `data-target` (ou logo depois do script), com Shadow DOM por padrão: o CSS
 * do widget não vaza no site. `data-isolate="none"` desliga.
 *
 * Outros atributos: `data-loading` (`lazy`, `idle`), `data-name` e
 * `data-origins` (origens extras do JS e do CSS, separadas por espaço, quando
 * não são a do manifesto).
 */
import { configure } from './index'
import { defineVitralElement, type VitralRemoteElement } from './element'
import { protocol } from './core/state'
import { absolute, pageOrigin } from './core/util'

const DONE = 'data-vitral-embed'

/**
 * Monta o widget descrito pelos `data-*` de `script`. Devolve o elemento, ou
 * `null` se faltar `data-remote`, se o script já foi processado ou se o
 * destino ainda não existe (aí espera o HTML terminar de carregar).
 */
export function embed(script: HTMLScriptElement): VitralRemoteElement | null {
  const data = script.dataset
  if (!data.remote || script.hasAttribute(DONE)) return null
  // Sem destino, o widget fica logo depois do script (no fim do body, se o script está no head).
  const target = data.target ? document.querySelector(data.target) : script.closest('body') ? script : document.body
  if (!target) {
    // `async` pode rodar antes de o parser chegar no destino.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => embed(script), { once: true })
    else console.error(`[vitral] data-target não encontrado: ${data.target}`)
    return null
  }
  script.setAttribute(DONE, '')
  const src = absolute(data.remote)
  // Antes de definir o elemento: um `<vitral-remote>` que já estava na página já encontra a allowlist.
  allow([new URL(src).origin, ...(data.origins?.split(/\s+/).filter(Boolean) ?? [])])
  defineVitralElement()
  const el = document.createElement('vitral-remote')
  el.setAttribute('isolate', data.isolate || 'shadow')
  if (data.loading) el.setAttribute('loading', data.loading)
  if (data.props) el.setAttribute('props', data.props)
  if (data.name) el.setAttribute('name', data.name)
  el.setAttribute('src', src)
  if (target === script) script.after(el)
  else target.appendChild(el)
  return el
}

/**
 * Num site de terceiros, `<vitral-remote src>` não pode virar porta de
 * entrada: HTML injetado no site (um comentário, um campo de perfil) com
 * outra origem levaria a lib a executar JS dela. O loader fixa
 * `allowedOrigins` nas origens dos widgets que ele montou, mais as que já
 * valiam na página.
 */
function allow(origins: string[]) {
  const p = protocol()
  const current = p.settings().allowedOrigins ?? ([pageOrigin(), ...p.origins()].filter(Boolean) as string[])
  configure({ allowedOrigins: [...new Set([...current, ...origins])] })
}

// Com várias tags na página, a primeira cópia que rodou atende todas (um cache de CSS só).
const KEY = Symbol.for('vitral:embed')
const run = ((globalThis as { [KEY]?: typeof embed })[KEY] ??= embed)
if (typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement) run(document.currentScript)
