import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import { checkCaseProps, diffProps, installDom, propFields, publishedTypes, test, tsLiteral, typeErrors } from '../src/cli/test'
import { typesFile } from '../src/vite/types'
import type { Contract } from '../src/testing'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const dir = mkdtempSync(join(cache, 'cli-test-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

// Cada checagem cria um programa do TypeScript em memória: no CI, com cobertura
// e os outros arquivos rodando juntos, passa dos 5 s padrão.
const TS = 30_000

describe('diffProps', { timeout: TS }, () => {
  it('lista o que quebra e o que é compatível', () => {
    const d = diffProps(
      '{ itens: number; cupom?: string; tema: "claro"; antigo: boolean; id: string | number; nome?: string }',
      '{ itens: number; cupom: string; tema: "claro" | "escuro"; id: string; nome: string; moeda: string; extra?: number }',
      ts,
    )
    expect(d.breaking).toEqual([
      'cupom virou obrigatória',
      'nome virou obrigatória',
      'prop obrigatória nova: moeda: string',
      'prop removida: antigo: boolean (o host que ainda passa antigo não compila)',
      expect.stringMatching(/^tipo de id mudou: string \| number → string \(/),
    ])
    expect(d.compatible).toEqual(['prop opcional nova: extra: number', 'tipo de tema aceita mais valores: "claro" → "claro" | "escuro"'])
  })

  it('não vê mudança em espaço e ponto e vírgula, e marca opcional como compatível', () => {
    expect(diffProps('{ a: number; }', '{ a: number }', ts)).toEqual({ breaking: [], compatible: [] })
    expect(diffProps('{ a: number }', '{ a?: number }', ts)).toEqual({ breaking: [], compatible: ['a virou opcional'] })
  })

  it('compara o tipo inteiro quando não é um objeto simples, e sem TypeScript conta tudo como quebra', () => {
    expect(diffProps('Record<string, unknown>', '{ a: number } & { b?: string }', ts).breaking).toHaveLength(1)
    expect(diffProps('{ a: number } & {}', 'Record<string, unknown>', ts)).toEqual({ breaking: [], compatible: ['Props mudou: { a: number } & {} → Record<string, unknown>'] })
    expect(diffProps('{ a: number }', '{ a: string }', null).breaking[0]).toContain('sem TypeScript')
  })

  it('lê os campos de um tipo objeto', () => {
    expect(propFields(ts, '{ a: number; "b-c"?: string }')).toEqual(
      new Map([
        ['a', { optional: false, type: 'number' }],
        ['b-c', { optional: true, type: 'string' }],
      ]),
    )
    expect(propFields(ts, '{ f(): void }')).toBeNull()
    expect(propFields(ts, 'string')).toBeNull()
  })

  it('separa os erros de cada trecho', () => {
    const [a, b, c] = typeErrors(ts, ['export const x: number = 1', 'export const y: number = "1"', 'export const z: string = 2'])
    expect(a).toEqual([])
    expect(b).toHaveLength(1)
    expect(c).toHaveLength(1)
  })
})

describe('props gravadas contra o Props local', { timeout: TS }, () => {
  it('gera literais TypeScript a partir dos marcadores', () => {
    expect(tsLiteral({ a: [1, 'x', null], f: { $fn: true }, d: { $date: '1970-01-01T00:00:00.000Z' }, u: { $unknown: 'Map' }, n: undefined })).toBe(
      '{ "a": [1, "x", null], "f": ((..._a: any[]): any => undefined), "d": new Date("1970-01-01T00:00:00.000Z"), "u": (undefined as any), "n": undefined }',
    )
  })

  it('falha com prop obrigatória nova ou tipo errado, e avisa de prop que o remote não declara mais', () => {
    const contract: Contract = { remote: 'c', cases: [{ props: { itens: 2, onFechar: { $fn: true } }, updates: [{ itens: '3' }] }] }
    expect(checkCaseProps(contract, '{ itens: number; onFechar?: () => void }', ts)).toEqual({ failures: [expect.stringContaining('caso 1, update 1: props não batem')], warnings: [] })
    const r = checkCaseProps(contract, '{ itens: number; moeda: string }', ts)
    expect(r.failures).toHaveLength(2)
    expect(r.failures[0]).toMatch(/^caso 1: props não batem com o Props local: .*moeda/)
    expect(r.warnings).toEqual(['caso 1: o host passa uma prop que o remote não declara: onFechar'])
    const extra = checkCaseProps({ remote: 'c', cases: [{ props: { itens: 2, velho: true } }] }, '{ itens: number } & {}', ts)
    expect(extra).toEqual({ failures: [], warnings: [expect.stringContaining('caso 1: o host passa uma prop que o remote não declara: ')] })
  })
})

describe('publishedTypes', () => {
  it('acha o vitral.d.ts a partir da URL, do manifesto ou da pasta', () => {
    expect(publishedTypes('https://cdn/c/1.0.0/vitral.json', dir)).toBe('https://cdn/c/1.0.0/vitral.d.ts')
    expect(publishedTypes('https://cdn/c/1.0.0', dir)).toBe('https://cdn/c/1.0.0/vitral.d.ts')
    expect(publishedTypes('https://cdn/c/x.d.ts', dir)).toBe('https://cdn/c/x.d.ts')
    expect(publishedTypes('.', dir)).toBe(join(dir, 'vitral.d.ts'))
    expect(publishedTypes('velho.d.ts', dir)).toBe(join(dir, 'velho.d.ts'))
  })
})

// Remote em disco, sem dependências: o Node importa e o happy-dom dá o DOM.
const REMOTE = `
export default {
  mount(el, props, ctx) {
    el.innerHTML = '<button>' + props.itens + ' itens</button>'
    ctx.events.on('tema', (t) => ctx.events.emit('carrinho:tema-aplicado', t))
    el.addEventListener('click', () => ctx.events.emit('carrinho:compra', 1))
    ${'${EMIT}'}
    return { update(p) { el.textContent = p.itens }, unmount() { el.replaceChildren() } }
  },
}
`

function build(name: string, emit: string, props: string) {
  const out = join(dir, name, 'dist')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'remote-abc.js'), REMOTE.replace('${EMIT}', emit))
  writeFileSync(join(out, 'vitral.json'), JSON.stringify({ name: 'carrinho', entry: 'remote-abc.js' }))
  writeFileSync(join(out, 'vitral.d.ts'), typesFile('carrinho', props))
  return join(dir, name)
}

const contrato: Contract = {
  remote: 'carrinho',
  host: 'loja',
  cases: [
    {
      props: { itens: 2 },
      updates: [{ itens: 3 }],
      inputs: [{ type: 'tema', payload: 'escuro' }],
      emits: [
        { type: 'carrinho:pronto', phase: 'mount' },
        { type: 'carrinho:tema-aplicado', phase: 'input' },
        { type: 'carrinho:compra', phase: 'later' },
      ],
      listens: ['tema'],
    },
  ],
}

describe('npx vitral test', { timeout: TS }, () => {
  it('reproduz o contrato no build do remote, em happy-dom', async () => {
    const root = build('ok', "ctx.events.emit('carrinho:pronto')", '{ itens: number }')
    mkdirSync(join(root, 'contracts'))
    writeFileSync(join(root, 'contracts/carrinho.contract.json'), JSON.stringify(contrato))
    writeFileSync(join(root, 'contracts/leia-me.txt'), 'não é contrato')
    const logs: string[] = []
    expect(typeof (globalThis as any).document).toBe('undefined')
    expect(await test({ cwd: root, contracts: ['contracts'], log: (m) => logs.push(m) })).toBe(0)
    expect(logs.at(-1)).toMatch(/carrinho\.contract\.json: 1 caso\(s\) passaram\.$/)
    // O DOM simulado sai depois do comando.
    expect(typeof (globalThis as any).document).toBe('undefined')
  })

  it('falha quando o remote some com um evento ou pede prop nova', async () => {
    const root = build('quebrado', '', '{ itens: number; moeda: string }')
    writeFileSync(join(root, 'c.json'), JSON.stringify(contrato))
    const logs: string[] = []
    const falhas = await test({ cwd: root, contracts: ['c.json'], log: (m) => logs.push(m) })
    expect(falhas).toBe(3)
    expect(logs).toContain('✗ carrinho (host loja): caso 1: o host escuta "carrinho:pronto" e o remote não emitiu (na gravação saiu no mount)')
    expect(logs.filter((l) => l.includes('props não batem'))).toHaveLength(2)
  })

  it('avisa quando não há Props local, e aceita --entry', async () => {
    const root = build('sem-tipos', "ctx.events.emit('carrinho:pronto')", '{ itens: number }')
    rmSync(join(root, 'dist/vitral.d.ts'))
    writeFileSync(join(root, 'c.json'), JSON.stringify(contrato))
    const logs: string[] = []
    expect(await test({ cwd: root, contracts: ['c.json'], entry: 'dist/remote-abc.js', log: (m) => logs.push(m) })).toBe(0)
    expect(logs[0]).toContain('não foram conferidas pelo tipo')
  })

  it('compara o vitral.d.ts publicado com o local', async () => {
    const root = build('diff', '', '{ itens: number; moeda: string }')
    const published = typesFile('carrinho', '{ itens: number; cupom?: string }')
    const fakeFetch = (async (url: string) => (url === 'https://cdn/carrinho/1.0.0/vitral.d.ts' ? new Response(published) : new Response('', { status: 404 }))) as unknown as typeof fetch
    const logs: string[] = []
    expect(await test({ cwd: root, since: 'https://cdn/carrinho/1.0.0/vitral.json', fetch: fakeFetch, log: (m) => logs.push(m) })).toBe(2)
    expect(logs).toEqual([
      '✗ quebra: prop obrigatória nova: moeda: string',
      '✗ quebra: prop removida: cupom: string (o host que ainda passa cupom não compila)',
      '[vitral] 2 mudança(s) nas props que quebram o host (desde https://cdn/carrinho/1.0.0/vitral.d.ts).',
    ])
    writeFileSync(join(root, 'velho.d.ts'), typesFile('carrinho', '{ itens: number; moeda: string }'))
    logs.length = 0
    expect(await test({ cwd: root, since: 'velho.d.ts', log: (m) => logs.push(m) })).toBe(0)
    expect(logs).toEqual([`[vitral] props compatíveis com ${join(root, 'velho.d.ts')}.`])
    await expect(test({ cwd: root, since: 'https://cdn/outro', fetch: fakeFetch })).rejects.toThrow('HTTP 404')
    writeFileSync(join(root, 'vazio.d.ts'), 'export {}\n')
    await expect(test({ cwd: root, since: 'vazio.d.ts' })).rejects.toThrow('sem "export type Props"')
  })

  it('explica o que falta', async () => {
    await expect(test({ cwd: dir })).rejects.toThrow('--contract')
    await expect(test({ cwd: dir, contracts: ['nao-existe.json'] })).rejects.toThrow('contrato não encontrado')
    writeFileSync(join(dir, 'c.json'), JSON.stringify(contrato))
    await expect(test({ cwd: dir, contracts: ['c.json'] })).rejects.toThrow('vitral.json não existe')
    await expect(test({ cwd: dir, since: 'c.json', types: 'nada.d.ts' })).rejects.toThrow('sem Props local')
  })

  it('instala e tira o DOM do happy-dom', async () => {
    const close = await installDom(dir)
    expect(document.createElement('div').tagName).toBe('DIV')
    expect(typeof customElements.define).toBe('function')
    await close()
    expect(typeof (globalThis as any).document).toBe('undefined')
    expect(new Event('x').type).toBe('x')
    expect(readFileSync(join(dir, 'c.json'), 'utf8')).toContain('carrinho')
  })
})
