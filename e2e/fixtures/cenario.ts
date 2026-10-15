// Ajudantes das baterias que usam fixtures/server.mjs (rede, deploy, segurança).
import { expect, test as base, type Page } from '@playwright/test'

export const HOST_URL = 'http://localhost:4400'
export const CDN_URL = 'http://localhost:4401'

type Arquivo = 'manifesto' | 'js' | 'css'

/** O que o CDN de teste faz com um remote. */
export interface Cenario {
  /** Status HTTP por arquivo (ex.: `{ manifesto: 500 }`). */
  status?: Partial<Record<Arquivo, number>>
  /** Atraso em ms antes de responder, por arquivo. */
  atraso?: Partial<Record<Arquivo, number>>
  /** Status e atraso valem só nas primeiras N requisições de cada arquivo. */
  vezes?: number
  /** Atraso em ms em toda resposta (ida e volta). */
  latencia?: number
  /** Banda em bytes por segundo. */
  banda?: number
  /**
   * Entrega um JS diferente do original. `'com-manifesto'`: o manifesto também
   * é trocado e traz o hash do JS adulterado.
   */
  adulterado?: boolean | 'com-manifesto'
  /** Manifesto sem `integrity`: o JS entra por `import()` direto. */
  semIntegrity?: boolean
  /** Responde sem `Access-Control-Allow-Origin`. */
  semCors?: Arquivo | 'tudo'
  /** Campos que substituem os do manifesto. */
  manifesto?: Record<string, unknown>
}

/** Redes de referência (as do DevTools), aplicadas pelo servidor em todos os navegadores. */
export const REDES = {
  '3G lento': { latencia: 400, banda: 50_000 },
} satisfies Record<string, Cenario>

let seq = 0
/** URL do manifesto de `remote` no CDN de teste, com o cenário aplicado. */
export function cdn(remote: string, cenario: Cenario = {}): string {
  const id = `${process.pid}-${Date.now()}-${seq++}`
  const segment = Buffer.from(JSON.stringify({ id, ...cenario })).toString('base64url')
  return `${CDN_URL}/c/${segment}/${remote}/vitral.json`
}

export interface Host {
  page: Page
  /** Erros não tratados na página (devem ficar vazios). */
  erros: string[]
  /** Chama `configure()` do vitral na página. */
  configure(config: Record<string, unknown>): Promise<void>
  /** Monta um remote num `<section data-slot>` novo. */
  montar(name: string, options?: { props?: Record<string, unknown>; isolate?: 'shadow' | 'none' }): Promise<void>
  /** O `<section>` do remote: `data-status` é loading, ready ou error. */
  slot(name: string): ReturnType<Page['locator']>
  /** Espera o remote ficar pronto. */
  pronto(name: string): Promise<void>
  /** Espera o erro `code` no remote. */
  erro(name: string, code: string): Promise<void>
  /** Prova que o resto da página continua respondendo. */
  continuaFuncionando(): Promise<void>
  /** Recarrega a página do host (o estado do vitral recomeça). */
  recarregar(): Promise<void>
}

export const test = base.extend<{ host: Host; lib: string }>({
  /** Versão da lib no host (`test.use({ lib: 'publicada' })`). */
  lib: ['atual', { option: true }],
  host: async ({ page, lib }, use) => {
    const erros: string[] = []
    page.on('pageerror', (e) => {
      // O WebKit avisa como erro de página toda requisição barrada por CORS,
      // mesmo quando o vitral trata a falha. O teste confere o código de erro.
      if (/due to access control checks\.$/.test(e.message)) return
      erros.push(e.message)
    })
    await page.goto(`${HOST_URL}/?lib=${lib}`)
    await page.waitForFunction(() => (window as any).__pronto)
    const slot = (name: string) => page.locator(`section[data-slot="${name}"]`)
    let cliques = 0
    await use({
      async recarregar() {
        await page.reload()
        await page.waitForFunction(() => (window as any).__pronto)
        cliques = 0
      },
      page,
      erros,
      configure: (config) => page.evaluate((c) => (window as any).vitral.configure(c), config),
      montar: (name, options = {}) => page.evaluate(([n, o]) => (window as any).montar(n, o), [name, options] as const),
      slot,
      pronto: (name) => expect(slot(name)).toHaveAttribute('data-status', 'ready'),
      async erro(name, code) {
        await expect(slot(name)).toHaveAttribute('data-status', 'error')
        await expect(slot(name).locator('.status')).toHaveText(code)
      },
      async continuaFuncionando() {
        await page.locator('#contador').click()
        await expect(page.locator('#contador')).toHaveText(`cliques: ${++cliques}`)
      },
    })
    // Nenhuma falha de remote pode virar erro não tratado na página.
    expect(erros, 'erros não tratados na página').toEqual([])
  },
})

export { expect }
