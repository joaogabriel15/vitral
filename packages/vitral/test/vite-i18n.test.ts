import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import vitral from '../src/vite'
import { devTranslations, findTranslations } from '../src/vite/i18n'
import { hintsOf } from '../src/core/next-hints'

function project(layout: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'vitral-i18n-'))
  const w = (f: string, t: string) => {
    mkdirSync(dirname(join(root, f)), { recursive: true })
    writeFileSync(join(root, f), t)
  }
  w('package.json', JSON.stringify({ name: 'conta', type: 'module' }))
  w('src/remote.ts', `export default { mount() {} }\n`)
  for (const [f, data] of Object.entries(layout)) w(f, JSON.stringify(data, null, 2))
  return root
}

describe('traduções no build do remote', () => {
  it('um arquivo por língua e namespace, com hash, listado no vitral.json com o SRI', async () => {
    const root = project({
      'src/locales/pt-BR/conta.json': { titulo: 'Minha conta' },
      'src/locales/pt-BR/comum.json': { ok: 'Ok' },
      'src/locales/en/conta.json': { titulo: 'My account' },
    })
    const out = join(root, 'dist')
    await build({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/remote.ts', adapter: false, types: false, i18n: 'src/locales/{lng}/{ns}.json' })], build: { outDir: out } })
    const m = JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
    expect(Object.keys(m.i18n).sort()).toEqual(['en', 'pt-BR'])
    expect(Object.keys(m.i18n['pt-BR']).sort()).toEqual(['comum', 'conta'])
    const file = m.i18n['pt-BR'].conta
    expect(file).toMatch(/^i18n\/pt-BR\/conta-[\w-]{8}\.json$/)
    const text = readFileSync(join(out, file), 'utf8')
    expect(text).toBe('{"titulo":"Minha conta"}')
    expect(m.files[file]).toBe('sha384-' + createHash('sha384').update(text).digest('base64'))
    // O HTML do host Next pré-carrega as da língua aberta.
    expect(hintsOf(m, '/conta/vitral.json', {}).i18n!['pt-BR'].map((h) => h[0]).sort()).toEqual([`/conta/${m.i18n['pt-BR'].comum}`, `/conta/${file}`].sort())
  }, 60_000)

  it('sem {ns}, o namespace é o name do remote; em dev, os arquivos de origem', () => {
    const root = project({ 'locales/pt-BR.json': { a: 1 }, 'locales/en.json': { a: 2 }, 'locales/LEIA.md': 'x' })
    expect(findTranslations(root, './locales/{lng}.json', 'conta').map((t) => [t.lng, t.ns])).toEqual([['en', 'conta'], ['pt-BR', 'conta']])
    expect(devTranslations(root, 'locales/{lng}.json', 'conta')).toEqual({ en: { conta: '/locales/en.json' }, 'pt-BR': { conta: '/locales/pt-BR.json' } })
    expect(() => findTranslations(root, 'locales/x.json', 'conta')).toThrow(/precisa de \{lng\}/)
  })
})
