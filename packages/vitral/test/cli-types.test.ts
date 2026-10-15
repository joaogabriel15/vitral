import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { envFile, parseProps, types } from '../src/cli/types'
import { typesFile } from '../src/vite/types'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const dir = mkdtempSync(join(cache, 'cli-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const arquivos: Record<string, string> = {
  'https://cdn.exemplo.com/carrinho/vitral.d.ts': typesFile('carrinho', '{ userId: number; cupom?: string }'),
  'https://cdn.exemplo.com/perfil/vitral.d.ts': '// outro\nexport type Props = { id: string };\n',
  'https://cdn.exemplo.com/vazio/vitral.d.ts': 'export {}\n',
}
const fakeFetch = (async (url: string) =>
  url in arquivos ? new Response(arquivos[url]) : new Response('', { status: 404 })) as unknown as typeof fetch

describe('npx vitral types', () => {
  it('lê o Props de um vitral.d.ts', () => {
    expect(parseProps(typesFile('x', '{ a: number }'))).toBe('{ a: number }')
    expect(parseProps('export type Props = {\n  a: number\n};\n')).toBe('{\n  a: number\n}')
    expect(parseProps('export {}')).toBeNull()
  })

  it('gera vitral-env.d.ts a partir do remotes.json, com base para urls relativas', async () => {
    mkdirSync(join(dir, 'public'), { recursive: true })
    writeFileSync(join(dir, 'public/remotes.json'), JSON.stringify({ carrinho: '/carrinho/vitral.json', perfil: { url: '/perfil/vitral.json' } }))
    const logs: string[] = []
    const falhas = await types({ cwd: dir, base: 'https://cdn.exemplo.com', fetch: fakeFetch, log: (m) => logs.push(m) })
    expect(falhas).toBe(0)
    const out = readFileSync(join(dir, 'vitral-env.d.ts'), 'utf8')
    expect(out).toBe(envFile({ carrinho: '{ userId: number; cupom?: string }', perfil: '{ id: string }' }))
    expect(out).toContain(`declare module 'vitral' {\n  interface Remotes {\n    "carrinho": { userId: number; cupom?: string }`)
    expect(logs.at(-1)).toContain('2 remote(s)')
  })

  it('aceita pares nome=url e conta os remotes sem tipos', async () => {
    const logs: string[] = []
    const falhas = await types({
      cwd: dir,
      out: 'tipos.d.ts',
      args: ['carrinho=https://cdn.exemplo.com/carrinho/vitral.json', 'fora=https://cdn.exemplo.com/fora/vitral.json', 'vazio=https://cdn.exemplo.com/vazio/vitral.json'],
      fetch: fakeFetch,
      log: (m) => logs.push(m),
    })
    expect(falhas).toBe(1)
    expect(logs).toContain('[vitral] fora: sem tipos (HTTP 404).')
    expect(logs).toContain('[vitral] vazio: vitral.d.ts sem "export type Props".')
    expect(readFileSync(join(dir, 'tipos.d.ts'), 'utf8')).toBe(envFile({ carrinho: '{ userId: number; cupom?: string }' }))
  })

  it('o teste de tipos usa a saída real do comando', () => {
    expect(readFileSync(resolve(__dirname, 'types/vitral-env.d.ts'), 'utf8')).toBe(envFile({ carrinho: '{ userId: number; cupom?: string }' }))
  })

  it('sem remotes.json avisa o que passar', async () => {
    const vazio = mkdtempSync(join(cache, 'cli-'))
    await expect(types({ cwd: vazio, log: () => {} })).rejects.toThrow('remotes.json não encontrado')
    rmSync(vazio, { recursive: true, force: true })
  })
})
