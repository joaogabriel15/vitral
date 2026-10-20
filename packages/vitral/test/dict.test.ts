import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as zlib from 'node:zlib'
import { afterAll, describe, expect, it } from 'vitest'
import { dict, INDEX, nodeZstd } from '../src/cli/dict'
import { createDict, dictMatch, type DictIndex, type NodeResponse } from '../src/dict'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const dir = mkdtempSync(join(cache, 'dict-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const sha = (b: Buffer) => createHash('sha256').update(b).digest()
const H = ':aGFzaA==:'
const index: DictIndex = {
  version: 1,
  files: {
    'remote-BTYc3U-m.js': { type: 'text/javascript', deltas: { [H]: { dcz: 'remote-BTYc3U-m.js.aaa.dcz', dcb: 'remote-BTYc3U-m.js.aaa.dcb' } } },
    'split/estilo-a1b2c3d4.css': { type: 'text/css', deltas: { [H]: { dcb: 'split/estilo-a1b2c3d4.css.aaa.dcb' } } },
    'sem-hash.js': { type: 'text/javascript', deltas: {} },
  },
}
const corpos: Record<string, string> = {
  'remote-BTYc3U-m.js.aaa.dcz': 'DCZ',
  'remote-BTYc3U-m.js.aaa.dcb': 'DCB',
  'split/estilo-a1b2c3d4.css.aaa.dcb': 'CSS-DCB',
}
const lidos: string[] = []
const d = createDict({
  index,
  base: '/remotes/chat',
  read: (p) => {
    lidos.push(p)
    return corpos[p] === undefined ? null : new TextEncoder().encode(corpos[p])
  },
})
const req = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Request(`https://cdn.test${path}`, { headers, method })

describe('dictMatch', () => {
  it('troca o hash do Vite por * e escapa o resto', () => {
    expect(dictMatch('/remotes/chat/remote-BTYc3U-m.js')).toBe('/remotes/chat/remote-*.js')
    expect(dictMatch('/split/chunk-EMSB2NVX-ClURUYv5.js')).toBe('/split/chunk-EMSB2NVX-*.js')
    expect(dictMatch('/a/sem-hash.js')).toBe('/a/sem-hash.js')
    expect(dictMatch('/a(b)/x+y-a1b2c3d4.css')).toBe('/a\\(b\\)/x\\+y-*.css')
  })
})

describe('vitral/dict na Web', () => {
  it('responde dcz quando o navegador tem o dicionário e aceita dcz', async () => {
    const res = await d.fetch(req('/remotes/chat/remote-BTYc3U-m.js', { 'available-dictionary': H, 'accept-encoding': 'gzip, br, zstd, dcb, dcz' }))
    expect(res!.status).toBe(200)
    expect(res!.headers.get('content-encoding')).toBe('dcz')
    expect(res!.headers.get('content-type')).toBe('text/javascript')
    expect(res!.headers.get('vary')).toBe('Accept-Encoding, Available-Dictionary')
    expect(res!.headers.get('use-as-dictionary')).toBe('match="/remotes/chat/remote-*.js"')
    expect(res!.headers.get('cache-control')).toContain('immutable')
    expect(await res!.text()).toBe('DCZ')
  })

  it('cai para dcb sem dcz, e ignora codificação com q=0', async () => {
    const res = await d.fetch(req('/remotes/chat/remote-BTYc3U-m.js', { 'available-dictionary': H, 'accept-encoding': 'br, dcz;q=0, dcb' }))
    expect(res!.headers.get('content-encoding')).toBe('dcb')
    expect(await res!.text()).toBe('DCB')
    const css = await d.fetch(req('/remotes/chat/split/estilo-a1b2c3d4.css', { 'available-dictionary': H, 'accept-encoding': 'dcz, dcb' }))
    expect(css!.headers.get('content-type')).toBe('text/css')
    expect(await css!.text()).toBe('CSS-DCB')
  })

  it('HEAD responde só os cabeçalhos', async () => {
    const res = await d.fetch(req('/remotes/chat/remote-BTYc3U-m.js', { 'available-dictionary': H, 'accept-encoding': 'dcz' }, 'HEAD'))
    expect(res!.headers.get('content-encoding')).toBe('dcz')
    expect(await res!.text()).toBe('')
  })

  it('devolve undefined quando a resposta normal serve: sem dicionário, hash desconhecido, sem dcz/dcb, outro método ou caminho', async () => {
    const js = '/remotes/chat/remote-BTYc3U-m.js'
    expect(await d.fetch(req(js, { 'accept-encoding': 'br' }))).toBeUndefined()
    expect(await d.fetch(req(js, { 'available-dictionary': ':outro:', 'accept-encoding': 'dcz' }))).toBeUndefined()
    expect(await d.fetch(req(js, { 'available-dictionary': H, 'accept-encoding': 'br, zstd' }))).toBeUndefined()
    expect(await d.fetch(req(js, { 'available-dictionary': H }))).toBeUndefined()
    expect(await d.fetch(new Request(`https://cdn.test${js}`, { method: 'POST', headers: { 'available-dictionary': H, 'accept-encoding': 'dcz' } }))).toBeUndefined()
    expect(await d.fetch(req('/outro/remote-BTYc3U-m.js', { 'available-dictionary': H, 'accept-encoding': 'dcz' }))).toBeUndefined()
    expect(await d.fetch(req('/remotes/chat/%E0%A4%A', { 'available-dictionary': H, 'accept-encoding': 'dcz' }))).toBeUndefined()
    expect(await d.fetch(req('/remotes/chat/toString', { 'available-dictionary': H, 'accept-encoding': 'dcz' }))).toBeUndefined()
    expect(await d.fetch(req('/remotes/chat/sem-hash.js', { 'available-dictionary': 'constructor', 'accept-encoding': 'dcz' }))).toBeUndefined()
  })

  it('variante que sumiu do disco: devolve undefined', async () => {
    const vazio = createDict({ index, read: () => null })
    expect(await vazio.fetch(req('/remote-BTYc3U-m.js', { 'available-dictionary': H, 'accept-encoding': 'dcz' }))).toBeUndefined()
  })

  it('headers() marca os arquivos do índice como dicionário', () => {
    expect(d.headers('/remotes/chat/remote-BTYc3U-m.js')).toEqual({
      'Use-As-Dictionary': 'match="/remotes/chat/remote-*.js"',
      Vary: 'Accept-Encoding, Available-Dictionary',
    })
    expect(d.headers('/remotes/chat/sem-hash.js')!['Use-As-Dictionary']).toBe('match="/remotes/chat/sem-hash.js"')
    expect(d.headers('/remotes/chat/nao-existe.js')).toBeUndefined()
  })
})

function fakeRes() {
  const r = { headers: {} as Record<string, string>, status: 0, body: undefined as unknown, ended: false }
  const res: NodeResponse = {
    setHeader: (k, v) => (r.headers[k] = v),
    writeHead: (s, h) => {
      r.status = s
      Object.assign(r.headers, h)
    },
    end: (b) => {
      r.body = b
      r.ended = true
    },
  }
  return { r, res }
}

describe('vitral/dict no Node', () => {
  it('responde a variante', async () => {
    const { r, res } = fakeRes()
    await new Promise<void>((done, fail) => {
      res.end = (b) => {
        r.body = b
        done()
      }
      d.node({ method: 'GET', url: '/remotes/chat/remote-BTYc3U-m.js?x=1', headers: { 'available-dictionary': H, 'accept-encoding': ['br', 'dcz'] } }, res, fail)
    })
    expect(r.status).toBe(200)
    expect(r.headers['Content-Encoding']).toBe('dcz')
    expect(new TextDecoder().decode(r.body as Uint8Array)).toBe('DCZ')
  })

  it('sem variante: põe os cabeçalhos e chama next', () => {
    const { r, res } = fakeRes()
    let next = 0
    d.node({ method: 'GET', url: '/remotes/chat/remote-BTYc3U-m.js', headers: { 'accept-encoding': 'br' } }, res, () => next++)
    expect(next).toBe(1)
    expect(r.headers['Use-As-Dictionary']).toBe('match="/remotes/chat/remote-*.js"')
    expect(r.ended).toBe(false)
    const outro = fakeRes()
    d.node({ url: '/fora.js', headers: {} }, outro.res, () => next++)
    expect(next).toBe(2)
    expect(outro.r.headers).toEqual({})
  })

  it('HEAD, corpo em stream e variante sumida', async () => {
    const stream = createDict({
      index,
      read: (p) => (p.endsWith('.dcz') ? new Response('ST').body! : null),
    })
    const { r, res } = fakeRes()
    await new Promise<void>((done, fail) => {
      res.end = (b) => {
        r.body = b
        done()
      }
      stream.node({ method: 'GET', url: '/remote-BTYc3U-m.js', headers: { 'available-dictionary': H, 'accept-encoding': 'dcz' } }, res, fail)
    })
    expect(new TextDecoder().decode(r.body as Uint8Array)).toBe('ST')

    const head = fakeRes()
    await new Promise<void>((done, fail) => {
      head.res.end = (b) => {
        head.r.body = b
        done()
      }
      stream.node({ method: 'HEAD', url: '/remote-BTYc3U-m.js', headers: { 'available-dictionary': H, 'accept-encoding': 'dcz' } }, head.res, fail)
    })
    expect(head.r.body).toBeUndefined()

    const sumiu = fakeRes()
    await new Promise<void>((done) =>
      stream.node({ method: 'GET', url: '/remote-BTYc3U-m.js', headers: { 'available-dictionary': H, 'accept-encoding': 'dcb' } }, sumiu.res, () => done()),
    )
    expect(sumiu.r.headers['Use-As-Dictionary']).toBe('match="/remote-*.js"')
    expect(sumiu.r.status).toBe(0)
  })

  it('erro ao ler vai para next(err)', async () => {
    const quebrado = createDict({ index, read: () => Promise.reject(new Error('disco')) })
    const { res } = fakeRes()
    const err = await new Promise((done) => quebrado.node({ url: '/remote-BTYc3U-m.js', headers: { 'available-dictionary': H, 'accept-encoding': 'dcz' } }, res, done))
    expect((err as Error).message).toBe('disco')
  })
})

describe('npx vitral dict', () => {
  const v1 = join(dir, 'v1')
  const v2 = join(dir, 'v2')
  const app = (n: number) => `export function mount(el){el.textContent=${JSON.stringify('versão ' + n)}}\n` + 'const x = "código que não muda entre deploys";\n'.repeat(200)
  mkdirSync(join(v1, 'split'), { recursive: true })
  mkdirSync(join(v2, 'split'), { recursive: true })
  writeFileSync(join(v1, 'remote-AAAAAAAA.js'), app(1))
  writeFileSync(join(v2, 'remote-BBBBBBBB.js'), app(2))
  writeFileSync(join(v1, 'split/igual-CCCCCCCC.js'), 'igual')
  writeFileSync(join(v2, 'split/igual-CCCCCCCC.js'), 'igual')
  writeFileSync(join(v2, 'estilo-DDDDDDDD.css'), '.a{}')
  writeFileSync(join(v2, 'leia.txt'), 'fora')

  it('gera .dcz e .dcb com o cabeçalho do RFC 9842 e o índice', () => {
    const logs: string[] = []
    const brotliCalls: string[][] = []
    const idx = dict({
      dist: v2,
      from: [v1, v1],
      brotli: (input, dictionary) => {
        brotliCalls.push([input, dictionary])
        return Buffer.from('BR')
      },
      log: (t) => logs.push(t),
    })
    const old = readFileSync(join(v1, 'remote-AAAAAAAA.js'))
    const hash = sha(old)
    const key = `:${hash.toString('base64')}:`
    expect(Object.keys(idx.files).sort()).toEqual(['estilo-DDDDDDDD.css', 'remote-BBBBBBBB.js', 'split/igual-CCCCCCCC.js'])
    expect(idx.files['estilo-DDDDDDDD.css'].type).toBe('text/css')
    expect(idx.files['split/igual-CCCCCCCC.js'].deltas).toEqual({})
    const v = idx.files['remote-BBBBBBBB.js'].deltas[key]
    const id = hash.toString('hex').slice(0, 12)
    expect(v).toEqual({ dcz: `remote-BBBBBBBB.js.${id}.dcz`, dcb: `remote-BBBBBBBB.js.${id}.dcb` })
    expect(JSON.parse(readFileSync(join(v2, INDEX), 'utf8'))).toEqual(idx)
    // O mesmo dist em dois --from conta uma vez só.
    expect(brotliCalls).toEqual([[join(v2, 'remote-BBBBBBBB.js'), join(v1, 'remote-AAAAAAAA.js')]])

    const dcz = readFileSync(join(v2, v.dcz!))
    expect([...dcz.subarray(0, 8)]).toEqual([0x5e, 0x2a, 0x4d, 0x18, 0x20, 0x00, 0x00, 0x00])
    expect(dcz.subarray(8, 40).equals(hash)).toBe(true)
    const zstdDecompress = (zlib as unknown as { zstdDecompressSync: (b: Buffer, o: object) => Buffer }).zstdDecompressSync
    expect(zstdDecompress(dcz.subarray(40), { dictionary: old }).toString()).toBe(app(2))
    // A diferença entre as versões é pequena: o delta é bem menor que o arquivo.
    expect(dcz.length).toBeLessThan(120)

    const dcb = readFileSync(join(v2, v.dcb!))
    expect([...dcb.subarray(0, 4)]).toEqual([0xff, 0x44, 0x43, 0x42])
    expect(dcb.subarray(4, 36).equals(hash)).toBe(true)
    expect(dcb.subarray(36).toString()).toBe('BR')
    expect(logs.at(-1)).toContain('3 arquivos, 1 deltas')
  })

  it('sem brotli gera só .dcz e avisa', () => {
    const logs: string[] = []
    const idx = dict({ dist: v2, from: [v1], brotli: false, level: 3, log: (t) => logs.push(t) })
    expect(Object.values(idx.files['remote-BBBBBBBB.js'].deltas)[0]).toEqual({ dcz: expect.stringMatching(/\.dcz$/) })
    expect(logs.at(-1)).toContain('só .dcz')
  })

  it('o índice serve o middleware de ponta a ponta', async () => {
    const idx = dict({ dist: v2, from: [v1], brotli: false, log: () => {} })
    const mw = createDict({ index: idx, base: '/chat/', read: (p) => readFileSync(join(v2, p)) })
    const key = Object.keys(idx.files['remote-BBBBBBBB.js'].deltas)[0]
    const res = await mw.fetch(req('/chat/remote-BBBBBBBB.js', { 'available-dictionary': key, 'accept-encoding': 'br, dcz' }))
    expect(res!.headers.get('content-encoding')).toBe('dcz')
    const body = Buffer.from(await res!.arrayBuffer())
    const zstdDecompress = (zlib as unknown as { zstdDecompressSync: (b: Buffer, o: object) => Buffer }).zstdDecompressSync
    expect(zstdDecompress(body.subarray(40), { dictionary: readFileSync(join(v1, 'remote-AAAAAAAA.js')) }).toString()).toBe(app(2))
  })

  it('erros claros', () => {
    expect(() => dict({ dist: join(dir, 'nao'), from: [v1], log: () => {} })).toThrow('não existe')
    expect(() => dict({ dist: v2, from: [join(dir, 'nao')], log: () => {} })).toThrow('não existe')
  })

  it('detecta o zstd com dicionário do Node', () => {
    expect(typeof nodeZstd()).toBe('function')
  })
})
