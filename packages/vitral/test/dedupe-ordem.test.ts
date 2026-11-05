// Dois grupos de dedupe em que um usa o outro (`react-i18next` usa `react`):
// a cópia própria do segundo só roda depois que o primeiro entrou.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import vitral from '../src/vite'
import { groupDeps, type Group } from '../src/vite/dedupe'
import { resetProtocol } from '../src/core/state'

function project() {
  const root = mkdtempSync(join(tmpdir(), 'vitral-ordem-'))
  const w = (f: string, t: string) => {
    mkdirSync(dirname(join(root, f)), { recursive: true })
    writeFileSync(join(root, f), t)
  }
  w('package.json', JSON.stringify({ name: 'app', type: 'module' }))
  w('node_modules/base/package.json', JSON.stringify({ name: 'base', version: '1.0.0', type: 'module', exports: './i.js' }))
  w('node_modules/base/i.js', `export const base = 41\n`)
  w('node_modules/usa-base/package.json', JSON.stringify({ name: 'usa-base', version: '2.0.0', type: 'module', exports: './i.js', peerDependencies: { base: '^1' } }))
  // Lê o outro grupo ao rodar, como o react-i18next lê o React.
  w('node_modules/usa-base/i.js', `import { base } from 'base'\nexport const dobro = base + 1\n`)
  w('src/remote.ts', `import { dobro } from 'usa-base'\nexport default { mount() {}, dobro }\n`)
  return root
}

afterEach(() => resetProtocol())

describe('dedupe com um grupo que usa outro', () => {
  it('a ordem vem das dependências do pacote, sem ciclo', () => {
    const root = project()
    const g = (name: string): Group => ({ name, range: '', version: '', keys: [name], names: {}, pkgs: [name], dir: join(root, 'node_modules', name) })
    expect(groupDeps([g('usa-base'), g('base')])).toEqual(new Map([['base', []], ['usa-base', ['base']]]))
  })

  it('o arquivo único roda, com o grupo que usa o outro listado antes', async () => {
    const root = project()
    const out = join(root, 'dist')
    await build({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/remote.ts', adapter: false, types: false, dedupe: ['usa-base', 'base'] })], build: { outDir: out } })
    const m = JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
    expect((await import(pathToFileURL(join(out, m.entry)).href)).default.dobro).toBe(42)
    // Build dividido sem oferta na página: as cópias próprias, na mesma ordem.
    expect((await import(pathToFileURL(join(out, m.split.entry)).href)).default.dobro).toBe(42)
  }, 60_000)
})
