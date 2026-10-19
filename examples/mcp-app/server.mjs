// Servidor MCP mínimo, sem dependências: JSON-RPC por stdio (uma mensagem
// por linha). Registra a tool `clima` e o recurso ui://clima/app com o HTML
// gerado por `vite build` (dist/mcp-app.html).
//
//   pnpm build && node server.mjs
//
// Para um servidor de verdade, use o SDK (@modelcontextprotocol/sdk e
// @modelcontextprotocol/ext-apps/server): o recurso e a tool são os mesmos.
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const URI = 'ui://clima/app'
const MIME = 'text/html;profile=mcp-app'
const html = () => readFileSync(new URL('./dist/mcp-app.html', import.meta.url), 'utf8')

const tool = {
  name: 'clima',
  description: 'Mostra o clima de uma cidade',
  inputSchema: { type: 'object', properties: { cidade: { type: 'string' } }, required: ['cidade'] },
  // O host vê resourceUri e renderiza o recurso junto com o resultado.
  _meta: { ui: { resourceUri: URI } },
}

const methods = {
  initialize: (p) => ({
    protocolVersion: p.protocolVersion ?? '2025-11-25',
    capabilities: { tools: {}, resources: {} },
    serverInfo: { name: 'clima', version: '1.0.0' },
  }),
  ping: () => ({}),
  'tools/list': () => ({ tools: [tool] }),
  'tools/call': ({ name, arguments: args }) => {
    if (name !== 'clima') throw new Error(`tool desconhecida: ${name}`)
    const dados = { cidade: args.cidade, temperatura: 20 + (args.cidade.length % 10) }
    return { content: [{ type: 'text', text: `${dados.cidade}: ${dados.temperatura} °C` }], structuredContent: dados }
  },
  'resources/list': () => ({ resources: [{ uri: URI, name: 'clima', mimeType: MIME }] }),
  'resources/read': ({ uri }) => {
    if (uri !== URI) throw new Error(`recurso desconhecido: ${uri}`)
    return { contents: [{ uri: URI, mimeType: MIME, text: html() }] }
  },
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return
  const { id, method, params } = JSON.parse(line)
  if (id === undefined) return // notificações (notifications/initialized etc.)
  const reply = (body) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...body }) + '\n')
  const fn = methods[method]
  if (!fn) return reply({ error: { code: -32601, message: `método desconhecido: ${method}` } })
  try {
    reply({ result: fn(params ?? {}) })
  } catch (e) {
    reply({ error: { code: -32602, message: e.message } })
  }
})
