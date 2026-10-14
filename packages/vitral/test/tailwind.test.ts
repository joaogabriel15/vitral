// Transformações de CSS do plugin sobre o CSS completo que o Tailwind v4 gera
// (build de verdade com @tailwindcss/vite, minificado pelo Vite).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import tailwind from '@tailwindcss/vite'
import postcss from 'postcss'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RemoteManifest } from '../src/index'
import vitral, { type VitralViteOptions } from '../src/vite'

const root = resolve(__dirname, 'fixtures/tw-remote')
const dirs: string[] = []

async function buildCss(entry: string, options: Partial<VitralViteOptions> = {}): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), 'vitral-tw-'))
  dirs.push(outDir)
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [tailwind(), vitral({ entry, name: 'tw', ...options })],
    build: { outDir, emptyOutDir: true },
  })
  const manifest: RemoteManifest = JSON.parse(readFileSync(join(outDir, 'vitral.json'), 'utf8'))
  return readFileSync(join(outDir, manifest.css![0]), 'utf8')
}

// Mesma forma para comparar: sem espaços em volta de vírgulas e sem blocos vazios.
const normalize = (css: string) =>
  postcss
    .parse(css)
    .toString()
    .replace(/\s*,\s*/g, ',')
    .replace(/@layer theme(\{\}|;)/g, '')

const S = '[data-vitral-scope="tw"]'
let estatico: string
let tema: string
let referencia: string

beforeAll(async () => {
  ;[estatico, tema, referencia] = await Promise.all([
    buildCss('src/estatico.js'),
    buildCss('src/estatico.js', { theme: 'host' }),
    buildCss('src/referencia.js'),
  ])
}, 60_000)

afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

describe("theme: 'host' com o CSS do Tailwind v4", () => {
  it('sem a opção, o remote declara o próprio tema na raiz dele', () => {
    expect(estatico).toContain(`${S},${S}{--font-sans:`)
    expect(estatico).toMatch(/--color-marca:oklch\(60% \.15 145\)/)
    expect(estatico).toContain('background-color:var(--color-marca)}')
  })

  it('tira todas as variáveis do tema do remote', () => {
    expect(tema).not.toMatch(/[{;]--(?:color|font|spacing|text|radius|default)-[\w-]*:/)
    expect(tema).toContain('@layer theme{}')
  })

  it('cada var() do tema ganha o valor do build como fallback', () => {
    expect(tema).toContain('background-color:var(--color-marca, oklch(60% .15 145))')
    expect(tema).toContain('padding-inline:calc(var(--spacing, .25rem) * 4)')
    expect(tema).toContain('color-mix(in oklab, var(--color-marca, oklch(60% .15 145)) 50%, transparent)')
  })

  it('variáveis encadeadas viram fallbacks encadeados', () => {
    expect(tema).toMatch(/font-family:var\(--default-font-family, var\(--font-sans, -apple-system,/)
    expect(tema).toContain('line-height:var(--tw-leading,var(--text-lg--line-height, calc(1.75 / 1.125)))')
  })

  it('não mexe nas variáveis internas do Tailwind (--tw-*) nem no @property', () => {
    expect(tema).toContain('var(--tw-shadow-color,#0000001a)')
    expect(tema).toContain('var(--tw-ring-inset,)')
    expect(tema).toContain('@property --tw-gradient-from{syntax:"<color>";inherits:false;initial-value:#0000}')
  })

  it('dá o mesmo CSS que o theme(reference) do Tailwind', () => {
    expect(normalize(tema)).toBe(normalize(referencia))
  })
})
