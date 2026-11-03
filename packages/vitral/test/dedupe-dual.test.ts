// Dedupe de um pacote com ESM e CommonJS, condições `browser`/`default` no
// `exports` e um pacote CommonJS que faz `require` dele (o caso do axios, que
// travava o build na 0.7.x).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import vitral from '../src/vite'
import { protocol, resetProtocol } from '../src/core/state'
import { shared } from '../src/core/dedupe'
import type { RemoteManifest } from '../src/index'

const root = mkdtempSync(join(tmpdir(), 'vitral-dual-'))
const out = join(root, 'dist')
const write = (file: string, text: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), text)
}
let m: RemoteManifest

beforeAll(async () => {
  write('package.json', JSON.stringify({ name: 'app', type: 'module' }))
  const pkg = 'node_modules/httpc/'
  write(
    pkg + 'package.json',
    JSON.stringify({
      name: 'httpc',
      version: '1.21.0',
      type: 'module',
      main: './dist/node/httpc.cjs',
      exports: {
        '.': {
          browser: { require: './dist/browser/httpc.cjs', default: './index.js' },
          default: { require: './dist/node/httpc.cjs', default: './index.js' },
        },
        './package.json': './package.json',
      },
    }),
  )
  write(pkg + 'index.js', `import client from './lib/client.js'\nexport const { isHttpError, create } = client\nexport { client as default }\n`)
  // Como o axios: o export default é uma função com métodos, um deles com nome reservado (`delete`).
  const body = `function client() {}\nclient.id = 'httpc-proprio'\nclient.isHttpError = () => false\nclient.create = () => client\nclient.delete = () => 'del-proprio'\n`
  write(pkg + 'lib/client.js', body + `export default client\n`)
  const cjs = body + `module.exports = client\nmodule.exports.default = client\n`
  write(pkg + 'dist/node/httpc.cjs', cjs)
  write(pkg + 'dist/browser/httpc.cjs', cjs)
  // Pacote CommonJS que usa o httpc por require.
  write('node_modules/legacy/package.json', JSON.stringify({ name: 'legacy', version: '1.0.0', main: 'index.js' }))
  write('node_modules/legacy/index.js', `const httpc = require('httpc')\nexports.via = () => httpc.id + '|' + httpc.delete()\n`)
  write(
    'src/remote.js',
    `import httpc, { isHttpError } from 'httpc'\nimport { via } from 'legacy'\nexport default { mount() {}, id: httpc.id, isHttpError, via }\n`,
  )
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [vitral({ entry: 'src/remote.js', adapter: false, dedupe: ['httpc'], types: false })],
    build: { outDir: out, emptyOutDir: true },
  })
  m = JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
}, 60_000)

afterAll(() => rmSync(root, { recursive: true, force: true }))
afterEach(() => resetProtocol())

let copies = 0
async function importSplit(uses?: boolean) {
  const dir = join(out, `copia-${copies++}`)
  cpSync(join(out, 'split'), join(dir, 'split'), { recursive: true })
  const url = pathToFileURL(join(dir, m.split!.entry)).href
  // Como o loader faz: os nomes do manifesto, pela URL da entrada.
  if (uses) protocol().uses = { [url]: Object.fromEntries(m.dedupe!.map((d) => [d.name, d.uses])) }
  return (await import(url)).default
}

describe('dedupe de pacote ESM + CommonJS (como o axios)', () => {
  it('o build termina e o pacote vira um grupo com a faixa da versão instalada', () => {
    expect(m.dedupe).toEqual([expect.objectContaining({ name: 'httpc', range: '^1.21.0', version: '1.21.0' })])
  })

  it('sem oferta, o import e o require usam a cópia própria', async () => {
    protocol()
    const r = await importSplit()
    expect([r.id, r.via(), typeof r.isHttpError]).toEqual(['httpc-proprio', 'httpc-proprio|del-proprio', 'function'])
  })

  it('com a oferta do host, o import e o require do pacote CommonJS usam o objeto do host', async () => {
    // O host oferece o namespace ESM: só `isHttpError` e `default` saem por nome; `id` e `delete` ficam no default.
    const host = Object.assign(() => {}, { id: 'httpc-host', isHttpError: () => true, create: () => host, delete: () => 'del-host' })
    shared(protocol())('httpc', '1.22.0', { version: '1.22.0', load: async () => ({ httpc: { default: host, isHttpError: host.isHttpError } }) })
    const r = await importSplit(true)
    expect([r.id, r.via(), r.isHttpError()]).toEqual(['httpc-host', 'httpc-host|del-host', true])
  })

  it('o manifesto lista os nomes que o remote lê; oferta sem um deles: cópia própria, com aviso', async () => {
    expect(m.dedupe![0].uses!.httpc).toEqual(expect.arrayContaining(['isHttpError']))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Oferta só com alguns nomes (como a do host Next com webpack), sem `isHttpError`.
    shared(protocol())('httpc', '1.22.0', { version: '1.22.0', load: async () => ({ httpc: { default: { id: 'parcial' } } }) })
    const r = await importSplit(true)
    expect(r.id).toBe('httpc-proprio')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/a oferta de httpc não tem .*httpc isHttpError/))
    warn.mockRestore()
  })
})
