// Servidor do benchmark. Serve o vitral de `root` e os remotes de exemplo
// (React 3 vezes, em URLs diferentes, e Vue 1 vez), com brotli e cache como
// um CDN: arquivos com hash têm cache eterno; vitral.json sempre revalida.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8' }
const REMOTES = { react1: 'react', react2: 'react', react3: 'react', vue1: 'vue' }

export function startServer(root, port = 0) {
  const compressed = new Map()
  const fileFor = (path) => {
    if (path === '/' || path === '/index.html') return join(here, 'host.html')
    if (path.startsWith('/rotas/')) return join(here, 'rotas.html')
    const [, area, ...rest] = path.split('/')
    if (area === 'vitral') return join(root, 'packages/vitral/dist', ...rest)
    if (area === 'r' && REMOTES[rest[0]]) return join(root, 'examples/remotes', REMOTES[rest[0]], 'dist', ...rest.slice(1))
    return null
  }
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const file = fileFor(path)
    try {
      const info = file && (await stat(file))
      if (!info?.isFile()) throw new Error('404')
      const ext = extname(file)
      const etag = `"${info.size}-${info.mtimeMs}"`
      if (req.headers['if-none-match'] === etag) return void res.writeHead(304, { etag }).end()
      const headers = {
        etag,
        'content-type': types[ext] ?? 'application/octet-stream',
        'cache-control': /-[\w-]{6,}\.(js|css)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
      }
      let body = await readFile(file)
      if (/\bbr\b/.test(req.headers['accept-encoding'] ?? '') && ext !== '.png') {
        if (!compressed.has(file)) compressed.set(file, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }))
        body = compressed.get(file)
        headers['content-encoding'] = 'br'
      }
      res.writeHead(200, headers).end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startServer(resolve(here, process.argv[2] ?? '..'), 4300)
  console.log(s.url)
}
