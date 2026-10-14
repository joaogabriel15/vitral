import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'
import vitral from '../src/vite'
import { extractProps, typesFile } from '../src/vite/types'

const root = resolve(__dirname, 'fixtures/vite-types')
const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const outDir = mkdtempSync(join(cache, 'types-'))
afterAll(() => rmSync(outDir, { recursive: true, force: true }))

describe('tipos das props', () => {
  it('expande o tipo das props de um componente-função, sem imports', async () => {
    const props = await extractProps(root, join(root, 'src/App.tsx'))
    expect(props).toBe(
      '{ userId: number; itens?: Array<{ id: number; nome: string; relacionados?: Array<unknown> }>; modo: "compacto" | "completo"; ' +
        'ativo: boolean; criado: Date; par: [string, number]; extras: Record<string, number>; onSair?: (motivo: string) => void; "data-x"?: string }',
    )
  })

  it('lê o segundo parâmetro de mount()', async () => {
    expect(await extractProps(root, join(root, 'src/mount.ts'))).toBe('{ n: number; rotulo?: string }')
  })

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
