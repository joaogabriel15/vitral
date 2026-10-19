import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { add, checkRegistry, ITEM_FIELDS, loadRegistry, REGISTRY_SCHEMA, registry, type Registry } from '../src/cli/registry'
import { envFile } from '../src/cli/types'
import { typesFile } from '../src/vite/types'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const raiz = mkdtempSync(join(cache, 'registro-'))
afterAll(() => rmSync(raiz, { recursive: true, force: true }))
const pasta = () => mkdtempSync(join(raiz, 'p-'))

const CDN = 'https://cdn.exemplo.com'
const publicado: Record<string, string> = {
  [`${CDN}/carrinho/vitral.json`]: JSON.stringify({ name: 'carrinho', version: '1.4.0', entry: 'remote.js', integrity: 'sha384-AAA' }),
  [`${CDN}/carrinho/vitral.d.ts`]: typesFile('carrinho', '{ userId: number; cupom?: string }'),
  [`${CDN}/perfil/vitral.json`]: JSON.stringify({ name: 'perfil', entry: 'remote.js' }),
}
const registroJson: Registry = {
  name: 'loja',
  remotes: [
    { name: 'carrinho', url: 'carrinho/vitral.json', version: '1.4.0', props: '{ userId: number; cupom?: string }', owner: 'time-checkout', integrity: 'sha384-AAA', framework: 'react' },
    { name: 'perfil', url: `${CDN}/perfil/vitral.json`, owner: 'time-contas', framework: 'vue', description: 'Cartão do usuário' },
  ],
}
const fakeFetch = (extra: Record<string, string> = {}) =>
  (async (url: string) => {
    const all = { ...publicado, [`${CDN}/vitral-registry.json`]: JSON.stringify(registroJson), ...extra }
    return url in all ? new Response(all[url]) : new Response('', { status: 404 })
  }) as unknown as typeof fetch

describe('JSON Schema do registro', () => {
  const schema = JSON.parse(readFileSync(resolve(__dirname, '../../../docs/public/schema/vitral-registry.json'), 'utf8'))

  it('está publicado no endereço do $schema e tem os mesmos campos que o CLI aceita', () => {
    expect(schema.$id).toBe(REGISTRY_SCHEMA)
    expect(Object.keys(schema.$defs.remote.properties)).toEqual([...ITEM_FIELDS])
    expect(schema.$defs.remote.required).toEqual(['name', 'url'])
    expect(schema.required).toEqual(['remotes'])
  })

  it('aponta os problemas de um registro mal formado', () => {
    expect(checkRegistry(registroJson)).toEqual([])
    expect(checkRegistry({})).toEqual(['falta a lista "remotes"'])
    expect(
      checkRegistry({ extra: 1, remotes: [{ name: 'a/b', url: 'x' }, { name: 'c' }, { name: 'c', url: 'y', versao: '1', owner: 2 }] }),
    ).toEqual([
      'campo desconhecido "extra"',
      'remotes[0]: "name" inválido',
      'remotes[1]: falta "url"',
      'remotes[2]: "c" repetido',
      'remotes[2]: campo desconhecido "versao"',
      'remotes[2]: "owner" deve ser texto',
    ])
  })
})

describe('loadRegistry', () => {
  it('lê de uma URL e resolve as URLs relativas a partir dela', async () => {
    const reg = await loadRegistry(`${CDN}/vitral-registry.json`, raiz, fakeFetch())
    expect(reg.remotes.map((r) => r.url)).toEqual([`${CDN}/carrinho/vitral.json`, `${CDN}/perfil/vitral.json`])
  })

  it('lê de um arquivo e recusa um registro inválido', async () => {
    const dir = pasta()
    writeFileSync(join(dir, 'reg.json'), JSON.stringify(registroJson))
    expect((await loadRegistry('reg.json', dir)).remotes[0].url).toBe('carrinho/vitral.json')
    writeFileSync(join(dir, 'ruim.json'), JSON.stringify({ remotes: [{ name: 'x' }] }))
    await expect(loadRegistry('ruim.json', dir)).rejects.toThrow('remotes[0]: falta "url"')
    await expect(loadRegistry('nao.json', dir)).rejects.toThrow('não encontrado')
    await expect(loadRegistry(`${CDN}/nao.json`, dir, fakeFetch())).rejects.toThrow('HTTP 404')
  })
})

describe('npx vitral registry', () => {
  it('gera o registro a partir dos manifestos e do vitral.d.ts, mantendo dono e framework', async () => {
    const dir = pasta()
    writeFileSync(join(dir, 'remotes.json'), JSON.stringify({ carrinho: '/carrinho/vitral.json', perfil: '/perfil/vitral.json', fora: '/fora/vitral.json' }))
    writeFileSync(join(dir, 'vitral-registry.json'), JSON.stringify({ name: 'loja', remotes: [{ name: 'carrinho', url: 'velho', owner: 'time-checkout', framework: 'react' }] }))
    const logs: string[] = []
    expect(await registry({ cwd: dir, base: CDN, fetch: fakeFetch(), log: (m) => logs.push(m) })).toBe(1)
    expect(logs).toContain('[vitral] fora: manifesto indisponível (HTTP 404).')
    const out = JSON.parse(readFileSync(join(dir, 'vitral-registry.json'), 'utf8')) as Registry
    expect(checkRegistry(out)).toEqual([])
    expect(out).toEqual({
      $schema: REGISTRY_SCHEMA,
      name: 'loja',
      remotes: [
        { name: 'carrinho', url: `${CDN}/carrinho/vitral.json`, version: '1.4.0', props: '{ userId: number; cupom?: string }', owner: 'time-checkout', integrity: 'sha384-AAA', framework: 'react' },
        { name: 'perfil', url: `${CDN}/perfil/vitral.json` },
      ],
    })
  })
})

describe('npx vitral add', () => {
  it('adiciona ao public/remotes.json e gera os tipos', async () => {
    const dir = pasta()
    mkdirSync(join(dir, 'public'))
    writeFileSync(join(dir, 'public/remotes.json'), JSON.stringify({ perfil: { url: `${CDN}/perfil/vitral.json`, isolate: 'shadow' } }))
    const logs: string[] = []
    const falhas = await add({ cwd: dir, names: ['carrinho', 'perfil'], registry: `${CDN}/vitral-registry.json`, fetch: fakeFetch(), log: (m) => logs.push(m) })
    // perfil não publica vitral.d.ts
    expect(falhas).toBe(1)
    expect(JSON.parse(readFileSync(join(dir, 'public/remotes.json'), 'utf8'))).toEqual({
      perfil: { url: `${CDN}/perfil/vitral.json`, isolate: 'shadow' },
      carrinho: `${CDN}/carrinho/vitral.json`,
    })
    expect(logs[0]).toBe(`[vitral] carrinho@1.4.0 adicionado em ${join(dir, 'public/remotes.json')}`)
    expect(readFileSync(join(dir, 'vitral-env.d.ts'), 'utf8')).toBe(envFile({ carrinho: '{ userId: number; cupom?: string }' }, { carrinho: 'sha384-AAA' }))
  })

  it('cria remotes.json quando não há nenhum e usa vitral-registry.json do projeto', async () => {
    const dir = pasta()
    writeFileSync(join(dir, 'vitral-registry.json'), JSON.stringify({ remotes: registroJson.remotes.slice(1) }))
    expect(await add({ cwd: dir, names: ['perfil'], types: false, fetch: fakeFetch(), log: () => {} })).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'remotes.json'), 'utf8'))).toEqual({ perfil: `${CDN}/perfil/vitral.json` })
    expect(existsSync(join(dir, 'vitral-env.d.ts'))).toBe(false)
  })

  it('recusa remote fora do registro ou já registrado com outra URL (a não ser com force)', async () => {
    const dir = pasta()
    writeFileSync(join(dir, 'remotes.json'), JSON.stringify({ carrinho: 'https://outro/vitral.json' }))
    const logs: string[] = []
    const opts = { cwd: dir, registry: `${CDN}/vitral-registry.json`, types: false, fetch: fakeFetch(), log: (m: string) => logs.push(m) }
    expect(await add({ ...opts, names: ['nada', 'carrinho'] })).toBe(2)
    expect(logs).toEqual([
      '[vitral] nada: não está no registro. Disponíveis: carrinho, perfil.',
      '[vitral] carrinho: já está no remotes.json com https://outro/vitral.json. Use --force para trocar.',
    ])
    expect(JSON.parse(readFileSync(join(dir, 'remotes.json'), 'utf8'))).toEqual({ carrinho: 'https://outro/vitral.json' })
    expect(await add({ ...opts, names: ['carrinho'], force: true })).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'remotes.json'), 'utf8'))).toEqual({ carrinho: `${CDN}/carrinho/vitral.json` })
    await expect(add({ ...opts, names: [] })).rejects.toThrow('npx vitral add <remote>')
  })

  it('avisa quando o manifesto publicado mudou desde o registro', async () => {
    const dir = pasta()
    const logs: string[] = []
    const novo = fakeFetch({ [`${CDN}/carrinho/vitral.json`]: JSON.stringify({ name: 'carrinho', entry: 'remote.js', integrity: 'sha384-NOVO' }) })
    await add({ cwd: dir, names: ['carrinho'], registry: `${CDN}/vitral-registry.json`, types: false, fetch: novo, log: (m) => logs.push(m) })
    expect(logs[0]).toBe('[vitral] carrinho: o manifesto publicado mudou desde que o registro foi gerado.')
  })
})
