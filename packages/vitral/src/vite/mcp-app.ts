/**
 * `vitral({ target: 'mcp-app' })`: o remote vira um HTML único (JS e CSS
 * inline) para ser servido por um servidor MCP como recurso `ui://` com
 * `mimeType: 'text/html;profile=mcp-app'` (extensão MCP Apps, SEP-1865).
 *
 * O host MCP (Claude, ChatGPT, VS Code…) põe o HTML num iframe e conversa
 * com ele por postMessage em JSON-RPC 2.0. A ponte abaixo faz o papel de
 * host do vitral dentro do iframe:
 *
 *   iframe → host: ui/initialize · ui/notifications/initialized
 *                  ui/notifications/size-changed { width, height }
 *                  ui/message · ui/open-link · ui/update-model-context
 *                  notifications/message (ctx.reportError) · o que o remote pedir em ctx.mcp
 *   host → iframe: ui/notifications/tool-input(-partial) · tool-result · tool-cancelled
 *                  ui/notifications/host-context-changed · ui/resource-teardown · ping
 *
 * As notificações do host viram props (`toolInput`, `toolInputPartial`,
 * `toolResult`, `toolCancelled`, `hostContext`) e chegam ao remote por
 * `mount` e `update`. `ctx.events.emit` vira mensagem para o host:
 *
 *   'mcp:message'   texto (ou { text }) → ui/message, como mensagem do usuário
 *   'mcp:open-link' url (ou { url })    → ui/open-link
 *   outro tipo                          → ui/update-model-context, com o último
 *                                         payload de cada tipo em structuredContent
 *
 * Especificação: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
 */

/** Versão do protocolo MCP Apps que a ponte declara no `ui/initialize`. */
export const MCP_APP_PROTOCOL = '2026-01-26'

/** `mimeType` do recurso `ui://` que o servidor MCP registra. */
export const MCP_APP_MIME = 'text/html;profile=mcp-app'

/** Nome da variável global do bundle IIFE do remote. */
export const MCP_APP_GLOBAL = '__vitral_remote__'

/**
 * Código da ponte. Texto fixo, como o `FRAME_RUNTIME` do iframe: roda no
 * navegador sem passar pelo bundler de quem usa a lib.
 */
export const MCP_RUNTIME = `function (w, mod, info) {
  var parent = w.parent, doc = w.document, seq = 0, pending = {}, handlers = {}, last = {}, context = {}
  var props = {}, mounted = null, ready = false, dirty = false
  function send(m) { m.jsonrpc = '2.0'; parent.postMessage(m, '*') }
  function request(method, params) {
    var id = ++seq
    return new Promise(function (ok, fail) {
      pending[id] = [ok, fail]
      send({ id: id, method: method, params: params || {} })
    })
  }
  function notify(method, params) { send({ method: method, params: params || {} }) }
  function report(e) { notify('notifications/message', { level: 'error', logger: info.name, data: String((e && e.message) || e) }) }
  function text(p, key) { return typeof p === 'string' ? p : p && p[key] }
  function push() { if (mounted && mounted.update) { try { mounted.update(Object.assign({}, props)) } catch (e) { report(e) } } }
  // Antes do mount terminar, só guarda: o update sai uma vez, logo depois.
  function set(key, value) { props[key] = value; if (ready) push(); else dirty = true }
  function theme(c) {
    if (!c) return
    var root = doc.documentElement, vars = c.styles && c.styles.variables
    if (c.theme) { root.setAttribute('data-theme', c.theme); root.style.colorScheme = c.theme }
    for (var k in vars) if (vars[k] != null) root.style.setProperty(k, vars[k])
  }
  var events = {
    emit: function (type, payload) {
      last[type] = payload
      ;(handlers[type] || []).slice().forEach(function (h) { try { h(payload) } catch (e) { w.console.error(e) } })
      if (type === 'mcp:message') request('ui/message', { role: 'user', content: [{ type: 'text', text: String(text(payload, 'text')) }] }).catch(report)
      else if (type === 'mcp:open-link') request('ui/open-link', { url: String(text(payload, 'url')) }).catch(report)
      else {
        context[type] = payload
        request('ui/update-model-context', { structuredContent: context, content: [{ type: 'text', text: JSON.stringify(context) }] }).catch(report)
      }
    },
    on: function (type, fn) {
      ;(handlers[type] = handlers[type] || []).push(fn)
      return function () { handlers[type] = handlers[type].filter(function (h) { return h !== fn }) }
    },
    last: function (type) { return last[type] }
  }
  var root = doc.createElement('div')
  root.setAttribute('data-vitral-root', info.name)
  if (info.scope) root.setAttribute('data-vitral-scope', info.scope)
  var ctx = {
    name: info.name, baseUrl: w.location.href, events: events, shadowRoot: null, portalContainer: doc.body, protocol: 1,
    reportError: report,
    navigate: function (url) { request('ui/open-link', { url: String(url) }).catch(report) },
    mcp: { request: request, notify: notify, hostContext: function () { return props.hostContext } }
  }
  function size() {
    var h = doc.documentElement, old = h.style.height
    h.style.height = 'max-content'
    var height = Math.ceil(h.getBoundingClientRect().height)
    h.style.height = old
    notify('ui/notifications/size-changed', { width: Math.ceil(w.innerWidth), height: height })
  }
  var on = {
    'ui/notifications/tool-input': function (p) { set('toolInput', p.arguments) },
    'ui/notifications/tool-input-partial': function (p) { set('toolInputPartial', p.arguments) },
    'ui/notifications/tool-result': function (p) { set('toolResult', p) },
    'ui/notifications/tool-cancelled': function (p) { set('toolCancelled', p.reason || true) },
    'ui/notifications/host-context-changed': function (p) { theme(p); set('hostContext', Object.assign({}, props.hostContext, p)) },
    'ui/resource-teardown': function () { if (mounted) mounted.unmount(); mounted = null; return {} },
    ping: function () { return {} }
  }
  w.addEventListener('message', function (e) {
    var m = e.data
    if (e.source !== parent || !m || m.jsonrpc !== '2.0') return
    if (m.method === undefined) {
      var p = pending[m.id]
      if (!p) return
      delete pending[m.id]
      return m.error ? p[1](new Error(m.error.message)) : p[0](m.result)
    }
    var fn = on[m.method], result
    if (m.id === undefined) return void (fn && fn(m.params || {}))
    if (!fn) return send({ id: m.id, error: { code: -32601, message: 'método desconhecido: ' + m.method } })
    try { result = fn(m.params || {}) } catch (err) { return send({ id: m.id, error: { code: -32603, message: String(err && err.message || err) } }) }
    send({ id: m.id, result: result })
  })
  request('ui/initialize', {
    appInfo: { name: info.name, version: info.version || '0.0.0' }, appCapabilities: {}, protocolVersion: '${MCP_APP_PROTOCOL}'
  }).then(function (r) {
    props.hostContext = r && r.hostContext
    theme(props.hostContext)
    notify('ui/notifications/initialized')
    doc.body.appendChild(root)
    var remote = (mod && mod.default) || mod
    if (!remote || typeof remote.mount !== 'function') throw new Error('o módulo não exporta mount()')
    dirty = false
    return remote.mount(root, Object.assign({}, props), ctx)
  }).then(function (handle) {
    mounted = handle
    ready = true
    if (dirty) push()
    size()
    if (w.ResizeObserver) { var ro = new w.ResizeObserver(size); ro.observe(doc.documentElement); ro.observe(doc.body) }
  }).catch(report)
}`

/** Escapa o fechamento da tag: o texto vai dentro de `<script>` ou `<style>`. */
const inline = (text: string, tag: 'script' | 'style') =>
  text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1').replace(/<!--/g, '<\\!--')

export interface McpAppPage {
  /** Nome do remote (vai em `appInfo` e em `data-vitral-root`). */
  name: string
  version?: string
  /** Escopo do CSS (`data-vitral-scope` da raiz), quando o CSS foi escopado. */
  scope?: string
  /** Bundle IIFE do remote, que define `MCP_APP_GLOBAL`. */
  code: string
  css: string[]
}

/** O HTML final, sem nenhum arquivo externo. */
export function mcpAppHtml(page: McpAppPage): string {
  const info = JSON.stringify({ name: page.name, version: page.version, scope: page.scope })
  const styles = page.css.map((css) => `<style>${inline(css, 'style')}</style>`).join('')
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${page.name.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</title>` +
    `<style>html,body{margin:0}body{display:flow-root}</style>${styles}</head><body>` +
    `<script>${inline(page.code, 'script')}</script>` +
    `<script>(${MCP_RUNTIME})(window, ${MCP_APP_GLOBAL}, ${inline(info, 'script')})</script>` +
    '</body></html>\n'
  )
}
