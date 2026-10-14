import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import vitral from '../src/vite'
import type { RemoteManifest } from '../src/index'

const root = resolve(__dirname, 'fixtures/vite-remote')
const outDir = mkdtempSync(join(tmpdir(), 'vitral-vite-'))
let manifest: RemoteManifest

beforeAll(async () => {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [vitral({ entry: 'src/remote.js' })],
    build: { outDir, emptyOutDir: true, assetsInlineLimit: 0 },
  })
  manifest = JSON.parse(readFileSync(join(outDir, 'vitral.json'), 'utf8'))
}, 60_000)

afterAll(() => rmSync(outDir, { recursive: true, force: true }))

describe('plugin vite', () => {
  it('gera vitral.json com nome e versão do package.json', () => {
    expect(manifest.name).toBe('@empresa/cartao')
    expect(manifest.version).toBe('1.2.3')
    expect(manifest.entry).toMatch(/^remote-[\w-]+\.js$/)
    expect(manifest.scope).toBe('-empresa-cartao')
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
