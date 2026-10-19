// SBOM do remote: build de um projeto com node_modules montado aqui mesmo
// (pacote usado, transitivo, removido pelo tree-shaking e não importado) e
// build com o React do repositório (layout do pnpm).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import vitral, { type VitralViteOptions } from '../src/vite'
import { purl } from '../src/vite/sbom'
import type { RemoteManifest } from '../src/index'

type Bom = {
  bomFormat: string
  specVersion: string
  serialNumber: string
  version: number
  metadata: { timestamp: string; tools: { components: { type: string; name: string; version?: string }[] }; component: Component & { hashes?: { alg: string; content: string }[] } }
  components: Component[]
  dependencies: { ref: string; dependsOn: string[] }[]
}
type Component = { type: string; 'bom-ref': string; name: string; group?: string; version?: string; purl?: string; licenses?: ({ expression: string } | { license: { name: string } })[] }

const tmp = mkdtempSync(join(tmpdir(), 'vitral-sbom-'))
const write = (file: string, text: string | object) => {
  mkdirSync(dirname(join(tmp, file)), { recursive: true })
  writeFileSync(join(tmp, file), typeof text === 'string' ? text : JSON.stringify(text))
}

// O projeto do remote.
write('loja/package.json', { name: '@empresa/loja', version: '2.0.0', license: 'MIT', dependencies: { '@acme/ui': '1', 'so-tipos': '1', 'nao-usado': '1', fechado: '1' } })
write('loja/src/remote.js', `import { botao } from '@acme/ui'\nimport { nada } from 'nao-usado'\nimport aviso from 'fechado'\nexport default { mount(el) { el.textContent = botao() + aviso; return { unmount() {} } } }\n`)
write('loja/node_modules/@acme/ui/package.json', { name: '@acme/ui', version: '1.4.0', license: 'Apache-2.0', main: 'dist/index.js', dependencies: { minusculo: '^3' } })
// package.json interno sem nome (padrão de pacotes ESM): não muda o pacote.
write('loja/node_modules/@acme/ui/dist/package.json', { type: 'module' })
write('loja/node_modules/@acme/ui/dist/index.js', `import { up } from 'minusculo'\nexport const botao = () => up('ok')\n`)
// Dependência transitiva, numa pasta aninhada (versão diferente da raiz).
write('loja/node_modules/@acme/ui/node_modules/minusculo/package.json', { name: 'minusculo', version: '3.1.0', license: '(MIT OR Apache-2.0)', main: 'index.js' })
write('loja/node_modules/@acme/ui/node_modules/minusculo/index.js', `export const up = (s) => s.toUpperCase()\n`)
write('loja/node_modules/minusculo/package.json', { name: 'minusculo', version: '1.0.0', license: 'MIT', main: 'index.js' })
write('loja/node_modules/minusculo/index.js', `export const up = (s) => s\n`)
// Importado, mas nada usado e sem efeitos colaterais: o tree-shaking tira.
write('loja/node_modules/nao-usado/package.json', { name: 'nao-usado', version: '9.9.9', license: 'MIT', main: 'index.js', sideEffects: false })
write('loja/node_modules/nao-usado/index.js', `export const nada = () => 'nada'\n`)
// Instalado e nunca importado.
write('loja/node_modules/so-tipos/package.json', { name: 'so-tipos', version: '1.0.0', license: 'MIT', main: 'index.js' })
write('loja/node_modules/so-tipos/index.js', `export const x = 1\n`)
// Licença que não é SPDX.
write('loja/node_modules/fechado/package.json', { name: 'fechado', version: '0.1.0', license: 'SEE LICENSE IN LICENSE.txt', main: 'index.js' })
write('loja/node_modules/fechado/index.js', `export default 'aviso'\n`)

async function buildRemote(root: string, out: string, options: VitralViteOptions = {}): Promise<RemoteManifest> {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [vitral({ entry: 'src/remote.js', adapter: false, types: false, ...options })],
    build: { outDir: out, emptyOutDir: true },
  })
  return JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
}

const out = join(tmp, 'dist')
const plain = join(tmp, 'dist-sem')
const reactOut = join(tmp, 'dist-react')
let m: RemoteManifest
let bom: Bom
let reactBom: Bom

beforeAll(async () => {
  m = await buildRemote(join(tmp, 'loja'), out, { sbom: true })
  bom = JSON.parse(readFileSync(join(out, 'sbom.cdx.json'), 'utf8'))
  await buildRemote(join(tmp, 'loja'), plain)
  await buildRemote(resolve(__dirname, 'fixtures/vite-dedupe'), reactOut, { sbom: true, dedupe: ['react'] })
  reactBom = JSON.parse(readFileSync(join(reactOut, 'sbom.cdx.json'), 'utf8'))
}, 60_000)

afterAll(() => rmSync(tmp, { recursive: true, force: true }))

/** Campos obrigatórios e formatos do CycloneDX 1.6 (bom-1.6.schema.json). */
function expectValidBom(b: Bom) {
  expect(b.bomFormat).toBe('CycloneDX')
  expect(b.specVersion).toBe('1.6')
  expect(b.serialNumber).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(Number.isInteger(b.version) && b.version >= 1).toBe(true)
  expect(b.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  const all = [b.metadata.component, ...b.metadata.tools.components, ...b.components]
  for (const c of all) {
    expect(['application', 'library', 'framework']).toContain(c.type)
    expect(typeof c.name).toBe('string')
    if (c.purl) expect(c.purl).toMatch(/^pkg:npm\/(%40[^/@]+\/)?[^/@]+(@[^@]+)?$/)
    for (const l of c.licenses ?? []) expect(Object.keys(l)).toEqual([('expression' in l ? 'expression' : 'license')])
  }
  // bom-ref único, e toda referência em dependencies existe.
  const refs = [b.metadata.component, ...b.components].map((c) => c['bom-ref'])
  expect(new Set(refs).size).toBe(refs.length)
  for (const d of b.dependencies) {
    expect(refs).toContain(d.ref)
    for (const r of d.dependsOn) expect(refs).toContain(r)
  }
  expect(new Set(b.dependencies.map((d) => d.ref)).size).toBe(b.dependencies.length)
}

const byName = (b: Bom) => Object.fromEntries(b.components.map((c) => [(c.group ? `${c.group}/` : '') + c.name, c]))

describe('sbom', () => {
  it('sem a opção, não gera nada', () => {
    expect(existsSync(join(plain, 'sbom.cdx.json'))).toBe(false)
    expect(JSON.parse(readFileSync(join(plain, 'vitral.json'), 'utf8')).sbom).toBeUndefined()
  })

  it('vitral.json aponta para o SBOM com o hash dele', () => {
    const text = readFileSync(join(out, 'sbom.cdx.json'))
    expect(m.sbom).toEqual({ file: 'sbom.cdx.json', integrity: 'sha384-' + createHash('sha384').update(text).digest('base64') })
  })

  it('segue os campos obrigatórios do CycloneDX 1.6', () => {
    expectValidBom(bom)
    expectValidBom(reactBom)
  })

  it('o remote é o componente principal, com o hash do JS publicado', () => {
    const main = bom.metadata.component
    expect(main).toMatchObject({ type: 'application', group: '@empresa', name: 'loja', version: '2.0.0', purl: 'pkg:npm/%40empresa/loja@2.0.0', licenses: [{ expression: 'MIT' }] })
    const js = readFileSync(join(out, m.entry))
    expect(main.hashes).toEqual([{ alg: 'SHA-512', content: createHash('sha512').update(js).digest('hex') }])
    expect(bom.metadata.tools.components[0]).toMatchObject({ name: 'vitral', version: expect.any(String) })
  })

  it('lista só os pacotes que entraram no bundle', () => {
    expect(Object.keys(byName(bom)).sort()).toEqual(['@acme/ui', 'fechado', 'minusculo'])
    // A cópia aninhada (3.1.0) é a que o @acme/ui usa; a da raiz não entrou.
    expect(byName(bom).minusculo).toMatchObject({ version: '3.1.0', purl: 'pkg:npm/minusculo@3.1.0' })
  })

  it('licenças: SPDX em expression, o resto como nome', () => {
    const c = byName(bom)
    expect(c['@acme/ui'].licenses).toEqual([{ expression: 'Apache-2.0' }])
    expect(c.minusculo.licenses).toEqual([{ expression: '(MIT OR Apache-2.0)' }])
    expect(c.fechado.licenses).toEqual([{ license: { name: 'SEE LICENSE IN LICENSE.txt' } }])
  })

  it('dependencies: do remote aos pacotes diretos e deles aos transitivos', () => {
    const deps = Object.fromEntries(bom.dependencies.map((d) => [d.ref, d.dependsOn]))
    expect(deps['pkg:npm/%40empresa/loja@2.0.0']).toEqual(['pkg:npm/%40acme/ui@1.4.0', 'pkg:npm/fechado@0.1.0'])
    expect(deps['pkg:npm/%40acme/ui@1.4.0']).toEqual(['pkg:npm/minusculo@3.1.0'])
  })

  it('pnpm: acha o pacote pelo caminho real (.pnpm/...) e inclui os transitivos', () => {
    const c = byName(reactBom)
    const version = (name: string) => JSON.parse(readFileSync(createRequire(import.meta.url).resolve(`${name}/package.json`), 'utf8')).version
    expect(c.react).toMatchObject({ version: version('react'), purl: `pkg:npm/react@${version('react')}`, licenses: [{ expression: 'MIT' }] })
    expect(Object.keys(c)).toEqual(expect.arrayContaining(['react', 'react-dom', 'scheduler']))
    const deps = Object.fromEntries(reactBom.dependencies.map((d) => [d.ref, d.dependsOn]))
    expect(deps[c['react-dom']['bom-ref']]).toEqual(expect.arrayContaining([c.react['bom-ref'], c.scheduler['bom-ref']]))
  })

  it('build reproduzível com SOURCE_DATE_EPOCH', async () => {
    process.env.SOURCE_DATE_EPOCH = '1700000000'
    try {
      const a = join(tmp, 'rep-a')
      const b = join(tmp, 'rep-b')
      await buildRemote(join(tmp, 'loja'), a, { sbom: true })
      await buildRemote(join(tmp, 'loja'), b, { sbom: true })
      const text = readFileSync(join(a, 'sbom.cdx.json'), 'utf8')
      expect(readFileSync(join(b, 'sbom.cdx.json'), 'utf8')).toBe(text)
      expect(JSON.parse(text).metadata.timestamp).toBe('2023-11-14T22:13:20Z')
    } finally {
      delete process.env.SOURCE_DATE_EPOCH
    }
  }, 60_000)

  it('purl com escopo e versão', () => {
    expect(purl('@acme/ui', '1.0.0-beta+1')).toBe('pkg:npm/%40acme/ui@1.0.0-beta%2B1')
    expect(purl('react')).toBe('pkg:npm/react')
  })
})
