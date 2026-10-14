// Servidores do e2e de estilos, todos com CORS:
// :4310 remotes (dist/remote), :4311 hosts (dist/host), :4312 "CDN de fontes" (fontes/).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.ttf': 'font/ttf' }
const roots = { 4310: join(here, 'dist', 'remote'), 4311: join(here, 'dist', 'host'), 4312: join(here, 'fontes') }

for (const [port, root] of Object.entries(roots)) {
  createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path)
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' })
      res.end(body)
    } catch {
      res.writeHead(404, { 'access-control-allow-origin': '*' }).end('not found')
    }
  }).listen(Number(port), () => console.log(`http://localhost:${port}`))
}
