import { resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import vitral from '../src/vite'
import { devEntryCode, scopeDevCss } from '../src/vite/dev'

const root = resolve(__dirname, 'fixtures/vite-remote')
let server: ViteDevServer
let base: string

beforeAll(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/remote.js' })], server: { port: 0 } })
  await server.listen()
  base = `http://localhost:${(server.httpServer!.address() as { port: number }).port}`
}, 30_000)
afterAll(() => server?.close())

const get = (path: string) => fetch(base + path, { headers: { origin: 'http://localhost:4201' } })

describe('modo dev', () => {
  it('serve /vitral.json sem integrity, com CORS e sem cache', async () => {
    const res = await get('/vitral.json')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ name: '@empresa/cartao', entry: '@vitral/entry.js', css: [], scope: '-empresa-cartao' })
  })

  it('o módulo de dev carrega o cliente HMR e o remote', async () => {
    const res = await get('/@vitral/entry.js')
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    const code = await res.text()
    expect(code).toContain('/@vite/client')
    expect(code).toContain('import.meta.hot.accept')
    expect(code).not.toContain('react-preamble')
  })

  it('o CSS servido em dev já sai com escopo', async () => {
    const css = await (await get('/src/style.css?direct')).text()
    expect(css).toContain('[data-vitral-scope="-empresa-cartao"] .cartao')
    expect(css).not.toMatch(/(^|[\s,}]):root/)
  })

  it('URLs de assets apontam para a origem do remote', () => {
    expect(server.config.server.origin).toBe(base)
  })

  it('React ganha o preâmbulo do Fast Refresh antes do remote', () => {
    const code = devEntryCode('react')
    expect(code.indexOf('react-preamble')).toBeLessThan(code.indexOf('import * as first'))
  })

  it('adapter: false importa o arquivo direto', () => {
    expect(devEntryCode('vue', '/a/remote.js')).toContain('import * as first from "/a/remote.js"')
  })

  it('não mexe em ?raw nem em arquivos que não são CSS', () => {
    expect(scopeDevCss('a{}', '/a.css?raw', 'x')).toBeUndefined()
    expect(scopeDevCss('a{}', '/a.js', 'x')).toBeUndefined()
    expect(scopeDevCss('a{}', '/App.vue?vue&type=style&index=0&lang.css', 'x')).toBe('[data-vitral-scope="x"] a{}')
  })
})
