// Servidor estático mínimo com CORS, só para a demo. Em produção use qualquer CDN.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const apps = { 'host-react': 5173, 'host-vue': 5174, 'remote-react': 5001, 'remote-vue': 5002 }
const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml' }

for (const [app, port] of Object.entries(apps)) {
  const dist = join(here, app, 'dist')
  createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    const file = join(dist, path === '/' ? 'index.html' : path)
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' })
      res.end(body)
    } catch {
      res.writeHead(404, { 'access-control-allow-origin': '*' }).end('not found')
    }
  }).listen(port, () => console.log(`${app.padEnd(13)} http://localhost:${port}`))
}
