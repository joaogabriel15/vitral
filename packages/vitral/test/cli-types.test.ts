import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { envFile, parseProps, readHashes, types } from '../src/cli/types'
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

  describe('hash do manifesto', () => {
    const remotos = ['carrinho=https://cdn.exemplo.com/carrinho/vitral.json', 'perfil=https://cdn.exemplo.com/perfil/vitral.json']
    const comManifesto = (hashes: Record<string, string | undefined>) =>
      (async (url: string) => {
        const nome = /\/(\w+)\/vitral\.json$/.exec(url)?.[1]
        if (nome && nome in hashes) return Response.json({ name: nome, entry: 'remote.js', integrity: hashes[nome] })
        return fakeFetch(url)
      }) as unknown as typeof fetch

    it('o arquivo gerado registra de qual manifesto veio cada tipo', async () => {
      const falhas = await types({ cwd: dir, out: 'hash.d.ts', args: remotos, fetch: comManifesto({ carrinho: 'sha384-AAA', perfil: undefined }), log: () => {} })
      expect(falhas).toBe(0)
      const out = readFileSync(join(dir, 'hash.d.ts'), 'utf8')
      expect(out).toBe(envFile({ carrinho: '{ userId: number; cupom?: string }', perfil: '{ id: string }' }, { carrinho: 'sha384-AAA' }))
      expect(out).toContain('// vitral:hash "carrinho" sha384-AAA\n')
      expect(readHashes(out)).toEqual({ carrinho: 'sha384-AAA' })
    })

    it('--check passa com os hashes em dia e falha quando um manifesto mudou', async () => {
      const fetch = comManifesto({ carrinho: 'sha384-AAA', perfil: 'sha384-BBB' })
      await types({ cwd: dir, out: 'check.d.ts', args: remotos, fetch, log: () => {} })
      const antes = readFileSync(join(dir, 'check.d.ts'), 'utf8')
      const logs: string[] = []
      expect(await types({ cwd: dir, out: 'check.d.ts', args: remotos, fetch, check: true, log: (m) => logs.push(m) })).toBe(0)
      expect(logs.at(-1)).toContain('em dia')

      logs.length = 0
      const novo = comManifesto({ carrinho: 'sha384-CCC', perfil: 'sha384-BBB' })
      expect(await types({ cwd: dir, out: 'check.d.ts', args: remotos, fetch: novo, check: true, log: (m) => logs.push(m) })).toBe(1)
      expect(logs).toContain('[vitral] carrinho: tipos desatualizados (o manifesto mudou).')
      expect(logs.at(-1)).toContain('npx vitral types')
      // --check não reescreve o arquivo
      expect(readFileSync(join(dir, 'check.d.ts'), 'utf8')).toBe(antes)
    })

    it('--check conta remote novo, removido ou sem arquivo gerado', async () => {
      const logs: string[] = []
      writeFileSync(join(dir, 'velho.d.ts'), envFile({ antigo: '{}' }, { antigo: 'sha384-X' }))
      const fetch = comManifesto({ carrinho: 'sha384-AAA' })
      expect(await types({ cwd: dir, out: 'velho.d.ts', args: [remotos[0]], fetch, check: true, log: (m) => logs.push(m) })).toBe(2)
      expect(logs).toContain('[vitral] carrinho: tipos desatualizados (sem hash registrado).')
      expect(logs).toContain('[vitral] antigo: não está mais no remotes.json.')
      expect(await types({ cwd: dir, out: 'nao-existe.d.ts', args: remotos, fetch, check: true, log: () => {} })).toBe(1)
    })
  })

  it('sem remotes.json avisa o que passar', async () => {
    const vazio = mkdtempSync(join(cache, 'cli-'))
    await expect(types({ cwd: vazio, log: () => {} })).rejects.toThrow('remotes.json não encontrado')
    rmSync(vazio, { recursive: true, force: true })
  })
})
