import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import vitral, { type VitralViteOptions } from '../src/vite'
import { collect } from '../src/vite/manifest'
import { splitShadowCss } from '../src/css-build'
import type { RemoteManifest } from '../src/index'

const outDir = mkdtempSync(join(tmpdir(), 'vitral-vite-'))
const splitDir = mkdtempSync(join(tmpdir(), 'vitral-split-'))
const shadowDir = mkdtempSync(join(tmpdir(), 'vitral-shadow-'))
let manifest: RemoteManifest
let splitManifest: RemoteManifest
let shadowManifest: RemoteManifest

async function buildRemote(fixture: string, out: string, options: VitralViteOptions = {}, manifestDir = out): Promise<RemoteManifest> {
  await build({
    root: resolve(__dirname, 'fixtures', fixture),
    configFile: false,
    logLevel: 'silent',
    // Sem adaptador: o embrulho traria o código da própria lib (que tem
    // import()) e o teste do build dividido deixaria de medir o remote.
    plugins: [vitral({ entry: 'src/remote.js', adapter: false, ...options })],
    build: { outDir: out, emptyOutDir: true, assetsInlineLimit: 0 },
  })
  return JSON.parse(readFileSync(join(manifestDir, 'vitral.json'), 'utf8'))
}

beforeAll(async () => {
  manifest = await buildRemote('vite-remote', outDir)
  splitManifest = await buildRemote('vite-split', splitDir, { contract: { version: '2.1.0' } })
  shadowManifest = await buildRemote('vite-shadow', shadowDir)
}, 60_000)

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true })
  rmSync(splitDir, { recursive: true, force: true })
  rmSync(shadowDir, { recursive: true, force: true })
})

const sha384 = (file: string) => 'sha384-' + createHash('sha384').update(readFileSync(file)).digest('base64')

describe('plugin vite', () => {
  it('gera vitral.json com nome e versão do package.json', () => {
    expect(manifest.name).toBe('@empresa/cartao')
    expect(manifest.version).toBe('1.2.3')
    expect(manifest.entry).toMatch(/^remote-[\w-]+\.js$/)
    expect(manifest.scope).toBe('-empresa-cartao')
  })

  it('contrato: só com a opção contract (ou com dedupe)', () => {
    expect(manifest.contract).toBeUndefined()
    expect(splitManifest.contract).toEqual({ version: '2.1.0' })
  })

  it('o integrity confere com os bytes do JS publicado', () => {
    const code = readFileSync(join(outDir, manifest.entry))
    expect(manifest.integrity).toBe('sha384-' + createHash('sha384').update(code).digest('base64'))
  })

  it('JS em um arquivo só', () => {
    expect(readdirSync(outDir).filter((f) => f.endsWith('.js'))).toEqual([manifest.entry])
  })

  it('CSS com hash no nome e com escopo', () => {
    expect(manifest.css).toHaveLength(1)
    const [css] = manifest.css!
    expect(css).toMatch(/^remote-[\w-]{8}\.css$/)
    expect(readdirSync(outDir)).not.toContain('remote.css')
    const text = readFileSync(join(outDir, css), 'utf8')
    expect(text).toContain('[data-vitral-scope="-empresa-cartao"] .cartao')
    expect(text).not.toMatch(/(^|[\s,}]):root/)
    const hash = createHash('sha256').update(text).digest('base64url').slice(0, 8)
    expect(css).toBe(`remote-${hash}.css`)
  })
})

describe('CSS preparado para o Shadow DOM', () => {
  const read = (file: string) => readFileSync(join(shadowDir, file), 'utf8')

  it('sem nada a separar, o Shadow DOM usa o mesmo arquivo', () => {
    expect(manifest.shadow).toEqual({ css: manifest.css })
  })

  it('separa @property e @font-face num arquivo global e lista o @import de outra origem', () => {
    const m = shadowManifest
    const [css] = m.css!
    const { css: [ready], global: [global], imports, rebase } = m.shadow as Required<NonNullable<RemoteManifest['shadow']>>
    expect(ready).toMatch(/^remote-shadow-[\w-]{8}\.css$/)
    expect(global).toMatch(/^remote-global-[\w-]{8}\.css$/)
    expect(imports).toEqual(['https://fontes.exemplo.com/familia.css'])
    // A URL só com o caminho ficou no @font-face, que vai num <link>: nada a reescrever.
    expect(rebase).toBeUndefined()
    // O CSS de sempre continua inteiro (hosts antigos e modo escopo).
    expect(read(css)).toMatch(/@import[^;]*familia\.css/)
    expect(read(css)).toContain('@property --giro')
    // O @import local o Vite já embutiu; o pronto não tem nada que a folha construída recuse.
    expect(read(ready)).toContain('[data-vitral-scope="fontes"] .base')
    expect(read(ready)).toContain('[data-vitral-scope="fontes"] .cartao')
    expect(read(ready)).not.toMatch(/@import|@property|@font-face/)
    expect(read(global)).toMatch(/^@property --giro[^}]*\}\s*@font-face[^}]*remota\.woff2[^}]*\}$/)
    for (const f of [css, ready, global]) expect(m.files![f]).toBe(sha384(join(shadowDir, f)))
  })

  it('url() relativa que sobra no CSS pronto marca rebase', () => {
    expect(splitShadowCss('.a { background: url(img/a.png) } .b { background: url(data:image/png;base64,AA) }').rebase).toBe(true)
    expect(splitShadowCss('.a { background: url(https://x.com/a.png) } @font-face { src: url(f.woff2) }').rebase).toBe(false)
  })

  it('@import com media e regras globais aninhadas', () => {
    const r = splitShadowCss('@import url(a.css) screen; @import "b.css"; @layer x { @font-face { font-family: X } .x { color: red } }')
    expect(r.imports).toEqual(['a.css', 'b.css'])
    expect(r.global).toBe('@font-face { font-family: X }')
    expect(r.css).toBe('@layer x { .x { color: red } }')
    expect(splitShadowCss('.a { color: red }')).toEqual({ css: '.a { color: red }', global: '', imports: [], rebase: false })
  })
})

describe('manifesto v2', () => {
  it('sem import dinâmico, só o arquivo único, com o hash de cada arquivo em files', () => {
    expect(manifest.split).toBeUndefined()
    expect(readdirSync(outDir)).not.toContain('split')
    expect(Object.keys(manifest.files!)).toEqual([manifest.entry, ...manifest.css!])
    for (const [file, hash] of Object.entries(manifest.files!)) expect(hash).toBe(sha384(join(outDir, file)))
    expect(manifest.files![manifest.entry]).toBe(manifest.integrity)
  })

  it('com import dinâmico, o build dividido sai ao lado do arquivo único', () => {
    const m = splitManifest
    expect(m.entry).toMatch(/^remote-[\w-]+\.js$/)
    expect(m.split!.entry).toMatch(/^split\/remote-[\w-]+\.js$/)
    expect(m.split!.chunks).toEqual([expect.stringMatching(/^split\/comum-[\w-]+\.js$/)])
    const js = readdirSync(join(splitDir, 'split')).map((f) => `split/${f}`)
    expect(js.sort()).toEqual(Object.keys(m.files!).filter((f) => f.startsWith('split/')).sort())
    expect(js).toHaveLength(3)
    for (const [file, hash] of Object.entries(m.files!)) expect(hash).toBe(sha384(join(splitDir, file)))
    // Um CSS só, o do arquivo único, com escopo e conferido.
    expect(readdirSync(splitDir, { recursive: true }).filter((f) => String(f).endsWith('.css'))).toEqual(m.css)
    expect(m.files![m.css![0]]).toBeDefined()
  })

  it('o arquivo único não tem import() e o dividido passa pelo helper', () => {
    const single = readFileSync(join(splitDir, splitManifest.entry), 'utf8')
    expect(single).not.toMatch(/\bimport\(/)
    expect(single).toContain('Gráfico: ')
    const entry = readFileSync(join(splitDir, splitManifest.split!.entry), 'utf8')
    const lazy = readdirSync(join(splitDir, 'split')).find((f) => f.startsWith('grafico-'))!
    const dep = splitManifest.split!.chunks![0].slice('split/'.length)
    expect(entry).toContain(`__vitralImport("./${lazy}",["./${dep}"])`)
    expect(entry).toMatch(/function __vitralImport\(u,d\)/)
    expect(entry.replace(/function __vitralImport[^\n]*/, '')).not.toMatch(/\bimport\(/)
  })

  it('recusa o build se um import() do remote não puder passar pelo helper', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitral-collect-'))
    try {
      mkdirSync(join(dir, 'split'))
      writeFileSync(join(dir, 'split/a.js'), 'const n = "./b.js"; export default () => import(n)')
      writeFileSync(join(dir, 'split/b.js'), 'export default 1')
      const bundle = {
        'split/a.js': { type: 'chunk', fileName: 'split/a.js', isEntry: true, imports: [], dynamicImports: ['split/b.js'] },
        'split/b.js': { type: 'chunk', fileName: 'split/b.js', isEntry: false, imports: [], dynamicImports: [] },
      }
      expect(() => collect(dir, bundle)).toThrow(/split\/b\.js/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('import() que o tree-shaking tirou não gera build dividido', () => {
    // Caso real: o remote empacota a lib, cujo import('./sri') some com o
    // código do host, mas o chunk continua listado em dynamicImports.
    const dir = mkdtempSync(join(tmpdir(), 'vitral-collect-'))
    try {
      mkdirSync(join(dir, 'split'))
      writeFileSync(join(dir, 'split/a.js'), 'import { x } from "./c.js"; export default x')
      writeFileSync(join(dir, 'split/b.js'), 'import { x } from "./c.js"; export default x')
      writeFileSync(join(dir, 'split/c.js'), 'export const x = 1')
      const bundle = {
        'split/a.js': { type: 'chunk', fileName: 'split/a.js', isEntry: true, imports: ['split/c.js'], dynamicImports: ['split/b.js'] },
        'split/b.js': { type: 'chunk', fileName: 'split/b.js', isEntry: false, imports: ['split/c.js'], dynamicImports: [] },
        'split/c.js': { type: 'chunk', fileName: 'split/c.js', isEntry: false, imports: [], dynamicImports: [] },
      }
      expect(collect(dir, bundle)).toBeUndefined()
      expect(readdirSync(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('versionDir', () => {
  it('grava o build em <outDir>/<versão> e mantém as versões anteriores', async () => {
    const base = mkdtempSync(join(tmpdir(), 'vitral-versao-'))
    try {
      mkdirSync(join(base, '1.0.0'))
      writeFileSync(join(base, '1.0.0/vitral.json'), '{}')
      const m = await buildRemote('vite-remote', base, { versionDir: true }, join(base, '1.2.3'))
      expect(m.version).toBe('1.2.3')
      expect(readdirSync(join(base, '1.2.3'))).toContain(m.entry)
      expect(readdirSync(base).sort()).toEqual(['1.0.0', '1.2.3'])
      await buildRemote('vite-remote', base, { versionDir: true, version: '2.0.0' }, join(base, '2.0.0'))
      expect(readdirSync(base).sort()).toEqual(['1.0.0', '1.2.3', '2.0.0'])
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }, 30_000)
})
