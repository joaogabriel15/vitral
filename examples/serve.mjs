// Servidor estático para os exemplos e o e2e: remotes em :4100/<framework>/,
// cada host Vite na sua porta. Next e Nuxt sobem com os próprios servidores.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' }

export const HOSTS = { vanilla: 4201, react: 4202, vue: 4203, svelte: 4204, solid: 4205, preact: 4206, angular: 4207 }

function serve(port, resolveFile, spa) {
  createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = resolveFile(path)
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    } catch {
      if (spa) file = spa
    }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' })
      res.end(body)
    } catch {
      res.writeHead(404, { 'access-control-allow-origin': '*' }).end('not found')
    }
  }).listen(port, () => console.log(`http://localhost:${port}`))
}

// /react/ilha.json → remotes/react/dist/ilha.json
serve(4100, (p) => {
  const [, fw, ...rest] = p.split('/')
  return join(here, 'remotes', fw ?? '', 'dist', ...rest)
})
for (const [host, port] of Object.entries(HOSTS)) {
  const dist = join(here, 'hosts', host, 'dist')
  serve(port, (p) => join(dist, p), join(dist, 'index.html'))
}
