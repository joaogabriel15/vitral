import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { createRequire } from 'node:module'
import type * as TS from 'typescript'
import { afterAll, describe, expect, it, vi } from 'vitest'
import vitral from '../src/vite'
import { loadOxc, propsFromOxc, type Oxc } from '../src/vite/oxc'
import { extractProps, typesFile } from '../src/vite/types'

vi.mock('../src/vite/oxc', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/vite/oxc')>()
  return { ...real, loadOxc: vi.fn(real.loadOxc) }
})

const root = resolve(__dirname, 'fixtures/vite-types')
const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const outDir = mkdtempSync(join(cache, 'types-'))
afterAll(() => rmSync(outDir, { recursive: true, force: true }))

const ts = createRequire(import.meta.url)('typescript') as typeof TS
// O caminho do TypeScript monta um programa inteiro: com a suíte em paralelo, passa de 5 s.
const realOxc = async () => (await vi.importActual<typeof import('../src/vite/oxc')>('../src/vite/oxc')).loadOxc(root)

/** Oxc de verdade (o do Vite 8), com um espião para saber se foi usado. */
async function spyOxc() {
  const oxc = (await realOxc())!
  const spy = vi.fn(oxc.isolatedDeclarationSync)
  vi.mocked(loadOxc).mockResolvedValueOnce({ isolatedDeclarationSync: spy })
  return spy
}

const APP =
  '{ userId: number; itens?: Array<{ id: number; nome: string; relacionados?: Array<unknown> }>; modo: "compacto" | "completo"; ' +
  'ativo: boolean; criado: Date; par: [string, number]; extras: Record<string, number>; onSair?: (motivo: string) => void; "data-x"?: string }'

describe('tipos das props', () => {
  it('expande o tipo das props de um componente-função, sem imports', async () => {
    vi.mocked(loadOxc).mockResolvedValueOnce(null)
    expect(await extractProps(root, join(root, 'src/App.tsx'))).toBe(APP)
  }, 30_000)

  it('TypeScript 7 no projeto (sem API em JS) não quebra o build: usa outro TypeScript ou não gera tipos', async () => {
    // O create-vite instala o TypeScript 7, que exporta só a versão.
    const ts7 = mkdtempSync(join(cache, 'ts7-'))
    cpSync(join(root, 'src'), join(ts7, 'src'), { recursive: true })
    writeFileSync(join(ts7, 'package.json'), '{"name":"ts7","type":"module"}')
    mkdirSync(join(ts7, 'node_modules/typescript'), { recursive: true })
    writeFileSync(join(ts7, 'node_modules/typescript/package.json'), '{"name":"typescript","version":"7.0.2","main":"index.js"}')
    writeFileSync(join(ts7, 'node_modules/typescript/index.js'), 'module.exports = { version: "7.0.2" }')
    vi.mocked(loadOxc).mockResolvedValueOnce(null)
    try {
      // Aqui o fallback acha o TypeScript 5 do repositório; numa instalação
      // só com o 7, devolve null e o build segue sem vitral.d.ts.
      expect(await extractProps(ts7, join(ts7, 'src/App.tsx'))).toEqual(expect.any(String))
    } finally {
      rmSync(ts7, { recursive: true, force: true })
    }
  }, 30_000)

  it('com Oxc, lê da declaração isolada (inclusive de imports relativos) e chega no mesmo tipo', async () => {
    const spy = await spyOxc()
    expect(await extractProps(root, join(root, 'src/App.tsx'))).toBe(APP)
    expect(spy.mock.calls.map((c) => c[0])).toEqual([join(root, 'src/App.tsx'), join(root, 'src/tipos.ts')])
  })

  it('Oxc reclamando (export sem tipo explícito), cai no TypeScript', async () => {
    const spy = await spyOxc()
    expect(await extractProps(root, join(root, 'src/mount.ts'))).toBe('{ n: number; rotulo?: string }')
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.results[0].value.errors.length).toBeGreaterThan(0)
  }, 30_000)

  it('Oxc e TypeScript dão o mesmo texto com tipos explícitos', async () => {
    const file = join(root, 'src/explicito.ts')
    const oxc = (await realOxc()) as Oxc
    const rapido = propsFromOxc(ts, oxc, file)
    expect(rapido).toBe(
      '{ opcoes: { tema?: "claro" | "escuro"; limite: number; [key: string]: unknown }; produto: Readonly<{ id: number; nome: string; relacionados?: Array<unknown> }>; ' +
        'on: (id: number) => void; tags: Array<string> }',
    )
    vi.mocked(loadOxc).mockResolvedValueOnce(null)
    expect(await extractProps(root, file)).toBe(rapido)
  }, 30_000)

  it('forma que o leitor do Oxc não conhece devolve null', async () => {
    const oxc = { isolatedDeclarationSync: () => ({ code: 'declare const x: { mount(el: HTMLElement, p: typeof y): void };\nexport default x;\n', errors: [] }) }
    expect(propsFromOxc(ts, oxc, join(root, 'src/explicito.ts'))).toBeNull()
  })

  it('lê o segundo parâmetro de mount()', async () => {
    expect(await extractProps(root, join(root, 'src/mount.ts'))).toBe('{ n: number; rotulo?: string }')
  }, 30_000)

  it('entrada .vue ou .svelte fica sem tipos', async () => {
    expect(await extractProps(root, join(root, 'src/App.vue'))).toBeNull()
  })

  it('o build publica vitral.d.ts ao lado do manifesto', async () => {
    await build({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/mount.ts' })], build: { outDir, emptyOutDir: true } })
    expect(readFileSync(join(outDir, 'vitral.d.ts'), 'utf8')).toBe(typesFile('carrinho', '{ n: number; rotulo?: string }'))
  }, 60_000)

  it('types: false não publica', async () => {
    const out = mkdtempSync(join(cache, 'types-'))
    await build({ root, configFile: false, logLevel: 'silent', plugins: [vitral({ entry: 'src/mount.ts', types: false })], build: { outDir: out, emptyOutDir: true } })
    expect(() => readFileSync(join(out, 'vitral.d.ts'))).toThrow()
    rmSync(out, { recursive: true, force: true })
  }, 60_000)
})
