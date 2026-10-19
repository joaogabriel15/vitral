/**
 * Modo dev do remote: `vite dev` serve `/vitral.json` apontando para um
 * módulo de desenvolvimento, com CORS e sem SRI. O módulo carrega o cliente
 * HMR do Vite (e o preâmbulo do React Fast Refresh) pela origem do remote,
 * então editar o remote atualiza o host sem recarregar a página.
 */
import type { ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import type { RemoteManifest } from '../index'
import { scopeCss } from '../css-scope'
import { detectAdapter, ENTRY_ID, type AdapterName } from './adapter'

/** Caminho do módulo de desenvolvimento, relativo ao `vitral.json`. */
export const DEV_ENTRY = '@vitral/entry.js'
export const VIRTUAL_DEV_ENTRY = '\0vitral:dev-entry'
const PREAMBLE_ID = 'virtual:vitral-react-preamble'

// Mesmo preâmbulo que o @vitejs/plugin-react põe no index.html, mas vindo da
// origem do remote: o host não tem o index.html do remote.
const REACT_PREAMBLE = `import { injectIntoGlobalHook } from '/@react-refresh'
injectIntoGlobalHook(window)
window.$RefreshReg$ ??= () => {}
window.$RefreshSig$ ??= () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
`

/**
 * Código do módulo de desenvolvimento. `raw` é o arquivo do remote quando o
 * export não deve ser embrulhado (`adapter: false`).
 *
 * Quando a edição não tem HMR próprio do framework (Lit, JS puro, Angular),
 * a atualização chega até aqui: o módulo novo é importado e só as instâncias
 * deste remote são remontadas, com as props atuais. A página não recarrega.
 */
export function devEntryCode(framework: AdapterName, raw?: string): string {
  const preamble = framework === 'react' ? `import '${PREAMBLE_ID}'\n` : ''
  const from = raw ? JSON.stringify(raw) : `'${ENTRY_ID}'`
  return `import '/@vite/client'
${preamble}import * as first from ${from}
let mod = first.default ?? first
const live = new Set()
export default {
  async mount(el, props, ctx) {
    const i = { props, handle: await mod.mount(el, props, ctx) }
    i.remount = async () => {
      i.handle.unmount()
      el.replaceChildren()
      i.handle = await mod.mount(el, i.props, ctx)
    }
    live.add(i)
    return {
      update(next) {
        i.props = next
        i.handle.update?.(next)
      },
      unmount() {
        live.delete(i)
        i.handle.unmount()
      },
    }
  },
}
if (import.meta.hot) {
  import.meta.hot.accept(${from}, (next) => {
    if (!next) return import.meta.hot.invalidate()
    mod = next.default ?? next
    for (const i of live) i.remount().catch((e) => console.error('[vitral] falha ao remontar depois da edição', e))
  })
}
`
}

/** Ids que `resolveDevId` trata, para o filtro do hook. */
export const DEV_IDS = /^virtual:vitral-react-preamble$|\/@vitral\/entry\.js$/

/** Ids dos módulos virtuais do modo dev. */
export function resolveDevId(id: string): string | undefined {
  if (id === PREAMBLE_ID) return '\0' + PREAMBLE_ID
  if (id.endsWith('/' + DEV_ENTRY)) return VIRTUAL_DEV_ENTRY
}

export function loadPreamble(id: string): string | undefined {
  if (id === '\0' + PREAMBLE_ID) return REACT_PREAMBLE
}

/** Manifesto do modo dev: sem `integrity`, porque o código muda a cada edição. */
export function devManifest(name: string, scope: string | undefined): RemoteManifest {
  return { name, entry: DEV_ENTRY, css: [], ...(scope ? { scope } : {}) }
}

/** CSS que passa por `scopeDevCss`, no formato de filtro de hook. */
export const DEV_CSS = { include: /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(\?|$)/, exclude: /[?&](raw|url|inline)\b/ }

/** CSS que o Vite injeta em dev também ganha o escopo, como no build. */
export function scopeDevCss(code: string, id: string, scope: string): string | undefined {
  if (!DEV_CSS.include.test(id) || DEV_CSS.exclude.test(id)) return
  return scopeCss(code, scope)
}

/**
 * Serve o `vitral.json` de dev e põe `server.origin`, para que URLs de assets
 * (imagens, fontes) apontem para o remote, não para a página do host.
 */
export function serveDevManifest(server: ViteDevServer, manifest: () => RemoteManifest): void {
  const path = `${server.config.base.replace(/\/?$/, '/')}vitral.json`
  server.httpServer?.once('listening', () => {
    const address = server.httpServer!.address()
    if (!server.config.server.origin && address && typeof address === 'object') {
      const protocol = server.config.server.https ? 'https' : 'http'
      ;(server.config.server as { origin?: string }).origin = `${protocol}://localhost:${address.port}`
    }
  })
  server.middlewares.use((req, res: ServerResponse, next) => {
    if (req.url?.split('?')[0] !== path) return next()
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    })
    res.end(JSON.stringify(manifest(), null, 2))
  })
}

/**
 * O host só chega à entrada do remote em runtime, então o Vite acharia as
 * dependências dela tarde, otimizaria de novo e recarregaria a página do host.
 * Aqui elas entram na varredura inicial: a entrada e o adaptador do vitral.
 */
export function devOptimizeDeps(plugins: unknown, entry: string, adapter?: AdapterName | false) {
  const named = [plugins].flat(Infinity).filter((p): p is { name: string } => typeof (p as { name?: unknown })?.name === 'string')
  const fw = adapter === false ? null : adapter || detectAdapter(named)
  const include = fw === null ? [] : fw === 'element' ? ['vitral', 'vitral/element'] : [`vitral/${fw}`]
  return { entries: [entry, '**/*.html'], include }
}
