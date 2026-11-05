import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import vitral from '../src/vite'

/** Remote com uma rota lazy e um pacote `big` usado pela entrada e pela rota. */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'vitral-saidas-'))
  const w = (f: string, t: string) => {
    mkdirSync(dirname(join(root, f)), { recursive: true })
    writeFileSync(join(root, f), t)
  }
  w('package.json', JSON.stringify({ name: 'app', type: 'module' }))
  w('node_modules/big/package.json', JSON.stringify({ name: 'big', version: '1.0.0', type: 'module', exports: './i.js' }))
  w('node_modules/big/i.js', `export const big = () => 'BIG${'b'.repeat(500)}'\n`)
  w('node_modules/@acme/ui/package.json', JSON.stringify({ name: '@acme/ui', version: '1.2.3', exports: { '.': './src/index.ts' } }))
  w('node_modules/@acme/ui/src/a.ts', `export const A = () => 'UI_A'\n`)
  w('node_modules/@acme/ui/src/b.ts', `export const B = () => 'UI_B${'u'.repeat(500)}'\n`)
  w('node_modules/@acme/ui/src/index.ts', `export { A } from './a'\nexport { B } from './b'\n`)
  w('src/route.ts', `import { big } from 'big'\nexport default () => big()\n`)
  w('src/remote.ts', `import { big } from 'big'\nimport { A } from '@acme/ui'\nexport default { mount() { big(); A(); return import('./route') } }\n`)
  return root
}

const vendor = (id: string) => (id.includes('node_modules') ? 'vendor' : undefined)
const files = (dir: string) => readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.js')).sort()

describe('opções de saída do usuário', () => {
  it('manualChunks vale no build dividido; o arquivo único continua um arquivo só, sem uma terceira saída', async () => {
    const root = project()
    const out = join(root, 'dist')
    await build({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/remote.ts', adapter: false, types: false })], build: { outDir: out, rollupOptions: { output: { manualChunks: vendor } } } })
    const m = JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
    expect(files(out).filter((f) => !f.startsWith('split/'))).toEqual([m.entry])
    expect(files(out).some((f) => /^split\/vendor-/.test(f))).toBe(true)
  }, 60_000)

  it('com dedupe, a cópia própria fica fora do grupo do usuário e não vem com o app', async () => {
    const root = project()
    const out = join(root, 'dist')
    await build({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/remote.ts', adapter: false, types: false, dedupe: ['@acme/ui/*'] })], build: { outDir: out, rollupOptions: { output: { manualChunks: vendor } } } })
    const m = JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
    const soon = [m.split.entry, ...m.split.chunks].map((f: string) => readFileSync(join(out, f), 'utf8')).join('\n')
    expect(soon).toContain('BIG')
    expect(soon).not.toContain('UI_B')
    expect(readFileSync(join(out, m.dedupe[0].file), 'utf8')).toContain('UI_B')
  }, 60_000)
})
