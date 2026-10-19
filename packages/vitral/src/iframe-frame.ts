/**
 * Código que roda dentro do iframe. É um texto fixo (não passa pelo bundler de
 * quem usa a lib), para o hash dele ser o mesmo em todo build: quem tem CSP
 * libera `'sha256-…'` do `FRAME_SCRIPT` em `script-src`.
 *
 * Mensagens, todas no formato `{ vitral: 1, type, data }`:
 *
 *   host → iframe: mount { name, key, url | code, css, scope, baseUrl, props }
 *                  update props · unmount · event { type, payload } · last { type, payload }
 *   iframe → host: ready · mounted · error { code, message } · size { height }
 *                  emit { type, payload } · on { type } · navigate { url, replace } · report { message }
 *
 * Tipos fora dessa lista vão para `channel` dos dois lados: é o ponto de
 * extensão para pontes novas (ex.: o estado compartilhado da Fase 2).
 */
export const FRAME_RUNTIME = `function (w, load) {
  var parent = w.parent, doc = w.document, handlers = {}, last = {}, channel = {}, mounted = null, stage = 'LOAD_FAILED'
  function post(type, data) { parent.postMessage({ vitral: 1, type: type, data: data }, '*') }
  function call(fn, arg) { try { fn(arg) } catch (e) { w.console.error(e) } }
  var events = {
    emit: function (type, payload) { post('emit', { type: type, payload: payload }) },
    on: function (type, fn) {
      if (!handlers[type]) { handlers[type] = []; post('on', { type: type }) }
      handlers[type].push(fn)
      return function () { handlers[type] = handlers[type].filter(function (h) { return h !== fn }) }
    },
    last: function (type) { return last[type] }
  }
  function start(d) {
    var root = doc.createElement('div')
    root.setAttribute('data-vitral-root', d.name)
    if (d.scope) root.setAttribute('data-vitral-scope', d.scope)
    doc.body.appendChild(root)
    // Ponto de extensão: uma ponte nova registra handlers em channel[tipo] e
    // acrescenta campos aqui (a Fase 2 acrescenta ctx.shared).
    var ctx = {
      name: d.name, baseUrl: d.baseUrl, events: events, shadowRoot: null, portalContainer: doc.body, protocol: 1,
      reportError: function (e) { post('report', { message: String((e && e.message) || e) }) },
      navigate: function (url, o) { post('navigate', { url: String(url), replace: !!(o && o.replace) }) }
    }
    Promise.all(d.css.map(function (href) {
      return new Promise(function (done) {
        var link = doc.createElement('link')
        link.rel = 'stylesheet'; link.href = href; link.crossOrigin = 'anonymous'
        link.onload = link.onerror = done
        doc.head.appendChild(link)
      })
    })).then(function () {
      return load(d.code ? w.URL.createObjectURL(new w.Blob([d.code], { type: 'text/javascript' })) : d.url)
    }).then(function (ns) {
      if (!d.key) return ns
      var table = ns.exposes, part = table && table[d.key]
      if (!part) { stage = 'NOT_EXPOSED'; throw new Error(d.name + ' não expõe ' + d.key) }
      return typeof part === 'function' ? part() : part
    }).then(function (ns) {
      var mod = (ns && ns.default) || ns
      if (!mod || typeof mod.mount !== 'function') { stage = 'INVALID_MODULE'; throw new Error('o módulo não exporta mount()') }
      stage = 'MOUNT_FAILED'
      return mod.mount(root, d.props, ctx)
    }).then(function (handle) {
      mounted = handle
      post('mounted')
      var size = function () { post('size', { height: Math.ceil(doc.body.getBoundingClientRect().height) }) }
      size()
      if (w.ResizeObserver) new w.ResizeObserver(size).observe(doc.body)
    }, function (e) {
      post('error', { code: stage, message: String((e && e.message) || e) })
    })
  }
  w.addEventListener('message', function (e) {
    var m = e.data
    if (e.source !== parent || !m || m.vitral !== 1) return
    var d = m.data
    if (m.type === 'mount') start(d)
    else if (m.type === 'update') { if (mounted && mounted.update) mounted.update(d) }
    else if (m.type === 'unmount') { if (mounted) mounted.unmount(); mounted = null }
    else if (m.type === 'last') last[d.type] = d.payload
    else if (m.type === 'event') {
      last[d.type] = d.payload
      ;(handlers[d.type] || []).slice().forEach(function (h) { call(h, d.payload) })
    } else (channel[m.type] || []).forEach(function (h) { call(h, d) })
  })
  post('ready')
}`

/** Script inline do iframe. Libere o hash dele no CSP (`script-src 'sha256-…'`). */
export const FRAME_SCRIPT = `(${FRAME_RUNTIME})(window, function (u) { return import(u) })`

export const FRAME_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}body{display:flow-root}</style></head>' +
  `<body><script>${FRAME_SCRIPT}</script></body></html>`
