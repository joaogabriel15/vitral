// Servidor das baterias de rede, deploy, versões e segurança.
//
//   http://localhost:4400  host: páginas de fixtures/pages e o vitral de packages/vitral/dist
//   http://localhost:4401  CDN dos remotes, com falhas sob encomenda
//
// CDN:
//   /c/<cenário>/<remote>/<arquivo>   remote de fixtures/remotes/<remote>.js (ou
//                                     examples/remotes/<fw>/dist para "ex-<fw>"),
//                                     com o cenário (JSON em base64url) aplicado.
//   /deploy/<id>/<arquivo>            remote com versão trocável no meio do teste.
//   POST /__deploy/<id>?versao=2&apagar=1  publica a versão (e apaga os arquivos antigos).
//
// Cenário (veja cenario.ts): status por arquivo, atraso, banda, só nas primeiras
// N requisições, JS adulterado, sem integrity e sem CORS.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { distDe, VERSOES } from '../versoes/libs.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = join(here, '../..')
export const HOST = 4400
export const CDN = 4401

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8' }
const IMMUTABLE = 'public, max-age=31536000, immutable'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha = (alg, data, enc = 'base64') => createHash(alg).update(data).digest(enc)
const safe = (p) => normalize(p).replace(/^(\.\.[/\\])+/, '')

/**
 * Pastas servidas em /libs/<nome>/: cada versão de versoes/libs.mjs e "copia",
 * a lib atual em outra URL (outra instância do módulo, como num segundo bundle).
 */
export const LIBS = {
  ...Object.fromEntries(Object.keys(VERSOES).map((v) => [v, distDe(v)])),
  copia: distDe('atual'),
}

// ---------------------------------------------------------------------------
// Remotes
// ---------------------------------------------------------------------------

/** Arquivos de um remote: manifesto e conteúdo de cada arquivo. */
function remoteFiles(remote) {
  // ex-<fw>: remote de examples/. v-<versão>-<remote>: buildado por versoes/build.mjs.
  const prefix = remote.match(/^(ex|v)-/)?.[1]
  if (prefix) {
    const rest = remote.slice(prefix.length + 1)
    const dist = prefix === 'ex' ? join(repo, 'examples/remotes', rest, 'dist') : join(here, '../versoes/dist', rest)
    if (!existsSync(join(dist, 'vitral.json'))) return null
    const manifest = JSON.parse(readFileSync(join(dist, 'vitral.json'), 'utf8'))
    const files = Object.fromEntries([manifest.entry, ...manifest.css].map((f) => [f, readFileSync(join(dist, f))]))
    return { manifest, files }
  }
  const src = join(here, 'remotes', `${remote}.js`)
  if (!existsSync(src)) return null
  const js = readFileSync(src)
  const entry = `remote-${sha('sha256', js, 'hex').slice(0, 8)}.js`
  const manifest = { name: remote, version: '1.0.0', entry, css: [], integrity: `sha384-${sha('sha384', js)}` }
  const files = { [entry]: js }
  const cssSrc = join(here, 'remotes', `${remote}.css`)
  if (existsSync(cssSrc)) {
    const css = readFileSync(cssSrc)
    const name = `remote-${sha('sha256', css, 'hex').slice(0, 8)}.css`
    manifest.css.push(name)
    files[name] = css
  }
  return { manifest, files }
}

// Remote de deploy: o JS muda com a versão, então o nome (com hash) também muda.
const deploys = new Map()
function deployFiles(id) {
  const d = deploys.get(id) ?? { versao: 1, apagadas: new Set() }
  deploys.set(id, d)
  const code = (v) =>
    Buffer.from(
      `window.__versoes = [...(window.__versoes ?? []), ${v}]\n` +
        `export default { mount(el, props) { el.innerHTML = '<p class="versao">v${v}</p>'; return { unmount() { el.textContent = '' } } } }\n`,
    )
  const files = {}
  for (let v = 1; v <= d.versao; v++) if (!d.apagadas.has(v)) files[`remote-v${v}-${sha('sha256', code(v), 'hex').slice(0, 8)}.js`] = code(v)
  const js = code(d.versao)
  const entry = `remote-v${d.versao}-${sha('sha256', js, 'hex').slice(0, 8)}.js`
  return { d, manifest: { name: 'deploy', version: `${d.versao}.0.0`, entry, css: [], integrity: `sha384-${sha('sha384', js)}` }, files }
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

/** JS adulterado: o original mais uma linha que deixa rastro. */
const tamper = (js) => Buffer.concat([js, Buffer.from('\nwindow.__adulterado = true\n')])

const counts = new Map()
/** Quantas vezes `key` já foi pedido (contando esta). */
const nth = (key) => {
  const n = (counts.get(key) ?? 0) + 1
  counts.set(key, n)
  return n
}

async function send(req, res, { status = 200, body = '', type, cache = 'no-cache', cors = true, banda }) {
  const headers = { 'content-type': type ?? 'text/plain', 'cache-control': cache }
  if (cors) headers['access-control-allow-origin'] = '*'
  let data = Buffer.isBuffer(body) ? body : Buffer.from(body)
  if (status === 200 && cache === 'no-cache') {
    const etag = `"${sha('sha1', data, 'hex')}"`
    headers.etag = etag
    if (req.headers['if-none-match'] === etag) return void res.writeHead(304, headers).end()
  }
  if (/\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && data.length > 1024) {
    data = gzipSync(data)
    headers['content-encoding'] = 'gzip'
  }
  headers['content-length'] = data.length
  res.writeHead(status, headers)
  if (!banda) return void res.end(data)
  // Banda limitada: pedaços a cada 100 ms.
  const chunk = Math.max(1, Math.round(banda / 10))
  for (let i = 0; i < data.length && !res.destroyed; i += chunk) {
    res.write(data.subarray(i, i + chunk))
    await sleep(100)
  }
  res.end()
}

function decode(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function cdn(req, res) {
  const url = new URL(req.url, 'http://x')
  const parts = safe(decodeURIComponent(url.pathname)).split('/').filter(Boolean)
  if (req.method === 'OPTIONS') return send(req, res, { status: 204 })

  if (parts[0] === '__deploy' && req.method === 'POST') {
    const { d } = deployFiles(parts[1])
    const old = d.versao
    d.versao = Number(url.searchParams.get('versao'))
    if (url.searchParams.get('apagar')) for (let v = 1; v <= old; v++) d.apagadas.add(v)
    return send(req, res, { body: 'ok' })
  }

  if (parts[0] === 'deploy') {
    const { manifest, files } = deployFiles(parts[1])
    const file = parts[2]
    if (file === 'vitral.json') return send(req, res, { body: JSON.stringify(manifest), type: TYPES['.json'] })
    if (files[file]) return send(req, res, { body: files[file], type: TYPES['.js'], cache: IMMUTABLE })
    return send(req, res, { status: 404, body: 'not found' })
  }

  if (parts[0] !== 'c' || parts.length < 4) return send(req, res, { status: 404, body: 'not found' })
  const opts = decode(parts[1])
  const remote = remoteFiles(parts[2])
  if (!opts || !remote) return send(req, res, { status: 404, body: 'not found' })
  const file = parts.slice(3).join('/')
  const kind = file === 'vitral.json' ? 'manifesto' : extname(file) === '.css' ? 'css' : 'js'
  // As falhas valem só nas primeiras `vezes` requisições de cada arquivo, se pedido.
  const n = nth(`${opts.id}:${parts[2]}:${kind}`)
  const active = !opts.vezes || n <= opts.vezes
  const cors = !(opts.semCors === 'tudo' || opts.semCors === kind)

  await sleep((opts.latencia ?? 0) + (active ? opts.atraso?.[kind] ?? 0 : 0))
  if (active && opts.status?.[kind]) return send(req, res, { status: opts.status[kind], body: 'erro simulado', cors })

  if (kind === 'manifesto') {
    const manifest = { ...remote.manifest }
    if (opts.semIntegrity) delete manifest.integrity
    // Ataque no CDN: o manifesto traz o hash do JS adulterado.
    if (opts.adulterado === 'com-manifesto') manifest.integrity = `sha384-${sha('sha384', tamper(remote.files[manifest.entry]))}`
    if (opts.manifesto) Object.assign(manifest, opts.manifesto)
    return send(req, res, { body: JSON.stringify(manifest), type: TYPES['.json'], cors, banda: opts.banda })
  }
  let body = remote.files[file]
  if (!body) return send(req, res, { status: 404, body: 'not found', cors })
  if (kind === 'js' && opts.adulterado) body = tamper(body)
  return send(req, res, { body, type: TYPES[extname(file)], cache: IMMUTABLE, cors, banda: opts.banda })
}

async function host(req, res) {
  const path = safe(decodeURIComponent(new URL(req.url, 'http://x').pathname))
  const [, area, lib, ...rest] = path.split('/')
  let file = null
  if (area === 'vitral') file = join(LIBS.atual, lib ?? '', ...rest)
  else if (area === 'libs' && LIBS[lib]) file = join(LIBS[lib], ...rest)
  // Rotas sem extensão caem no host (SPA), para testar navigate().
  else file = join(here, 'pages', extname(path) ? path : 'host.html')
  if (!existsSync(file)) return send(req, res, { status: 404, body: 'not found' })
  return send(req, res, { body: readFileSync(file), type: TYPES[extname(file)] })
}

export function start() {
  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
      console.error(e)
      if (!res.headersSent) res.writeHead(500).end(String(e))
    })
  return [createServer(wrap(host)).listen(HOST), createServer(wrap(cdn)).listen(CDN)]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start()
  console.log(`host http://localhost:${HOST}  cdn http://localhost:${CDN}`)
}
