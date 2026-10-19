import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { canal, channelManifest } from '../src/cli/canal'
import type { RemoteManifest } from '../src/core/types'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const dir = mkdtempSync(join(cache, 'canal-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const versao: RemoteManifest = {
  name: 'chat',
  version: '1.4.2',
  entry: 'remote-abc.js',
  css: ['remote.css', 'https://fonts.exemplo.com/f.css'],
  integrity: 'sha384-x',
  files: { 'remote.css': 'sha384-c', 'split/remote-def.js': 'sha384-d' },
  split: { entry: 'split/remote-def.js', chunks: ['./split/a.js'] },
  dedupe: [{ name: 'react', range: '^19', version: '19.1.0', file: 'split/react.js', chunks: ['split/b.js'] }],
  shadow: { css: ['remote.shadow.css'] },
}

/** O host resolve cada caminho a partir do manifesto do canal. */
const at = (u: string) => new URL(u, 'https://cdn.empresa.com/chat/stable/vitral.json').href

describe('npx vitral canal', () => {
  it('aponta todos os arquivos do manifesto para a pasta da versão', () => {
    const m = channelManifest(versao, '../1.4.2/')
    expect(at(m.entry)).toBe('https://cdn.empresa.com/chat/1.4.2/remote-abc.js')
    expect(m.css!.map(at)).toEqual(['https://cdn.empresa.com/chat/1.4.2/remote.css', 'https://fonts.exemplo.com/f.css'])
    expect(Object.keys(m.files!).map(at)).toEqual(['https://cdn.empresa.com/chat/1.4.2/remote.css', 'https://cdn.empresa.com/chat/1.4.2/split/remote-def.js'])
    expect(at(m.split!.entry)).toBe('https://cdn.empresa.com/chat/1.4.2/split/remote-def.js')
    expect(m.split!.chunks!.map(at)).toEqual(['https://cdn.empresa.com/chat/1.4.2/split/a.js'])
    expect(at(m.dedupe![0].file)).toBe('https://cdn.empresa.com/chat/1.4.2/split/react.js')
    expect(m.dedupe![0].chunks!.map(at)).toEqual(['https://cdn.empresa.com/chat/1.4.2/split/b.js'])
    // O resto (hashes, nome, versão, shadow) fica igual.
    expect({ ...m, entry: 0, css: 0, files: 0, split: 0, dedupe: 0 }).toEqual({ ...versao, entry: 0, css: 0, files: 0, split: 0, dedupe: 0 })
    expect(Object.values(m.files!)).toEqual(['sha384-c', 'sha384-d'])
  })

  it('caminho absoluto ou a partir da raiz não muda; manifesto mínimo continua mínimo', () => {
    expect(channelManifest({ name: 'x', entry: '/chat/remote.js' }, '../1/')).toEqual({ name: 'x', entry: '/chat/remote.js' })
    expect(channelManifest({ name: 'x', entry: 'https://cdn/r.js' }, '../1/')).toEqual({ name: 'x', entry: 'https://cdn/r.js' })
  })

  it('lê o manifesto em disco ou já publicado e grava o do canal', async () => {
    const source = join(dir, 'vitral.json')
    writeFileSync(source, JSON.stringify(versao))
    const out = join(dir, 'beta/vitral.json')
    await canal({ source, out })
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(channelManifest(versao, '../1.4.2/'))

    // Voltar o canal para uma versão antiga, sem build: a partir da URL dela.
    const pedidas: string[] = []
    const fetch = (async (url: string) => (pedidas.push(url), new Response(JSON.stringify({ ...versao, version: '1.3.0' })))) as unknown as typeof fetch
    const logs: string[] = []
    await canal({ source: 'https://cdn.empresa.com/chat/1.3.0/vitral.json', fetch, log: (t) => logs.push(t) })
    expect(pedidas).toEqual(['https://cdn.empresa.com/chat/1.3.0/vitral.json'])
    expect(JSON.parse(logs[0]).entry).toBe('../1.3.0/remote-abc.js')
  })

  it('--versao vence o version do manifesto; sem nenhum dos dois, falha', async () => {
    const source = join(dir, 'sem-versao.json')
    writeFileSync(source, JSON.stringify({ name: 'x', entry: 'r.js' }))
    const logs: string[] = []
    await canal({ source, version: '2.0.0', log: (t) => logs.push(t) })
    expect(JSON.parse(logs[0]).entry).toBe('../2.0.0/r.js')
    await expect(canal({ source })).rejects.toThrow('use --versao')
    const fetch = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
    await expect(canal({ source: 'https://cdn/x/vitral.json', fetch })).rejects.toThrow('HTTP 404')
  })
})
