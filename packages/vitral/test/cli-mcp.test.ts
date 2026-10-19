import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterAll, describe, expect, it } from 'vitest'
import { mcpServer, serveMcp, TOOLS } from '../src/cli/mcp'
import { typesFile } from '../src/vite/types'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const dir = mkdtempSync(join(cache, 'mcp-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const CDN = 'https://cdn.exemplo.com'
writeFileSync(
  join(dir, 'vitral-registry.json'),
  JSON.stringify({
    remotes: [
      { name: 'carrinho', url: `${CDN}/carrinho/vitral.json`, version: '1.4.0', props: '{ userId: number }', owner: 'time-checkout', framework: 'react' },
      { name: 'perfil', url: `${CDN}/perfil/vitral.json`, owner: 'time-contas', framework: 'vue', description: 'Cartão do usuário' },
    ],
  }),
)
const fakeFetch = (async (url: string) =>
  url === `${CDN}/carrinho/vitral.d.ts` ? new Response(typesFile('carrinho', '{ userId: number }')) : new Response('', { status: 404 })) as unknown as typeof fetch

const server = mcpServer({ cwd: dir, fetch: fakeFetch, version: '9.9.9' })
let id = 0
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const res = (await server.handle({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } })) as any
  return { text: res.result.content[0].text as string, isError: res.result.isError === true }
}

describe('npx vitral mcp', () => {
  it('responde initialize, ping e tools/list; ignora notificações', async () => {
    const init = (await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })) as any
    expect(init.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'vitral', version: '9.9.9' } })
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined()
    expect(await server.handle({ jsonrpc: '2.0', id: 'p', method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 'p', result: {} })
    const list = (await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as any
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['list_remotes', 'get_remote', 'add_remote'])
    expect(TOOLS.every((t) => t.inputSchema.type === 'object')).toBe(true)
  })

  it('erros de protocolo: método e ferramenta desconhecidos', async () => {
    expect(await server.handle({ jsonrpc: '2.0', id: 3, method: 'resources/list' })).toEqual({
      jsonrpc: '2.0',
      id: 3,
      error: { code: -32601, message: 'método desconhecido: resources/list' },
    })
    expect(((await server.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'x' } })) as any).error.code).toBe(-32602)
  })

  it('list_remotes lista e filtra', async () => {
    expect(JSON.parse((await call('list_remotes')).text).map((r: { name: string }) => r.name)).toEqual(['carrinho', 'perfil'])
    expect(JSON.parse((await call('list_remotes', { query: 'VUE' })).text)).toEqual([
      { name: 'perfil', owner: 'time-contas', framework: 'vue', description: 'Cartão do usuário' },
    ])
  })

  it('get_remote mostra as props e um exemplo; remote desconhecido é erro da ferramenta', async () => {
    const { text } = await call('get_remote', { name: 'carrinho' })
    expect(text).toContain('"props": "{ userId: number }"')
    expect(text).toContain('<Remote name="carrinho" props={props} />')
    expect(await call('get_remote', { name: 'nada' })).toEqual({ text: '"nada" não está no registro. Disponíveis: carrinho, perfil.', isError: true })
    expect((await call('get_remote', { name: 'carrinho', registry: 'nao.json' })).isError).toBe(true)
  })

  it('add_remote escreve o remotes.json e os tipos do host', async () => {
    const res = await call('add_remote', { name: 'carrinho' })
    expect(res.isError).toBe(false)
    expect(res.text).toContain('carrinho@1.4.0 adicionado')
    expect(JSON.parse(readFileSync(join(dir, 'remotes.json'), 'utf8'))).toEqual({ carrinho: `${CDN}/carrinho/vitral.json` })
    expect(readFileSync(join(dir, 'vitral-env.d.ts'), 'utf8')).toContain('"carrinho": { userId: number }')
  })

  it('fala por stdio, uma mensagem por linha', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const lines: string[] = []
    output.on('data', (d) => lines.push(...String(d).split('\n').filter(Boolean)))
    const done = serveMcp(input, output, { cwd: dir, fetch: fakeFetch })
    input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n')
    input.write('isto não é json\n')
    input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    input.end('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_remotes","arguments":{"query":"checkout"}}}\n')
    await done
    const msgs = lines.map((l) => JSON.parse(l))
    expect(msgs).toContainEqual({ jsonrpc: '2.0', id: 1, result: {} })
    expect(msgs).toContainEqual({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } })
    expect(msgs.find((m) => m.id === 2).result.content[0].text).toContain('"carrinho"')
    expect(msgs).toHaveLength(3)
  })
})
