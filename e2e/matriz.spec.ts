// Cada host (9 frameworks) carrega cada remote (8 frameworks): 72 combinações.
import { expect, test } from '@playwright/test'

const HOSTS = {
  'JS/TS puro': 4201,
  React: 4202,
  Vue: 4203,
  Svelte: 4204,
  Solid: 4205,
  Preact: 4206,
  Angular: 4207,
  Next: 4208,
  Nuxt: 4209,
}

const REMOTES = {
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  solid: 'Solid',
  preact: 'Preact',
  angular: 'Angular',
  lit: 'Lit',
  vanilla: 'Vanilla TS',
}

for (const [host, port] of Object.entries(HOSTS)) {
  test.describe(`host ${host}`, () => {
    test.beforeEach(async ({ page }) => {
      const erros: string[] = []
      page.on('pageerror', (e) => erros.push(e.message))
      ;(page as any).erros = erros
      await page.goto(`http://localhost:${port}`)
    })

    test('carrega os 8 remotes, sem erros na página', async ({ page }) => {
      for (const [nome, fw] of Object.entries(REMOTES)) {
        await expect(page.locator(`[data-remote="${nome}"] .fw`), nome).toHaveText(fw)
        await expect(page.locator(`[data-remote="${nome}"] .msg`)).toHaveText('olá')
      }
      expect((page as any).erros).toEqual([])
    })

    test('props atualizam sem remontar (estado interno preservado)', async ({ page }) => {
      for (const nome of Object.keys(REMOTES)) await page.locator(`[data-remote="${nome}"] .ping`).click()
      await page.locator('#mensagem').fill(`oi do ${host}`)
      for (const nome of Object.keys(REMOTES)) {
        await expect(page.locator(`[data-remote="${nome}"] .msg`), nome).toHaveText(`oi do ${host}`)
        await expect(page.locator(`[data-remote="${nome}"] .cliques`), nome).toHaveText('1')
      }
    })

    test('eventos chegam ao host vindos de qualquer remote', async ({ page }) => {
      for (const [nome, fw] of Object.entries(REMOTES)) {
        await page.locator(`[data-remote="${nome}"] .ping`).click()
        await expect(page.locator('#ultimo-ping'), nome).toHaveText(fw)
      }
    })

    test('remote fora do ar mostra erro sem afetar os outros', async ({ page }) => {
      await expect(page.locator('[data-remote="quebrado"] .erro')).toBeVisible()
      await page.locator('[data-remote="quebrado"] .erro button').click()
      await expect(page.locator('[data-remote="quebrado"] .erro')).toBeVisible()
      await expect(page.locator('[data-remote="react"] .fw')).toHaveText('React')
    })
  })
}

test.describe('SSR', () => {
  for (const [host, port] of [['Next', 4208], ['Nuxt', 4209]] as const) {
    test(`${host} renderiza o fallback no servidor, sem quebrar`, async ({ request }) => {
      const res = await request.get(`http://localhost:${port}`)
      expect(res.status()).toBe(200)
      const html = (await res.text()).replaceAll('<!-- -->', '')
      expect(html).toContain(`Host ${host}`)
      expect(html).toContain('data-vitral="react"')
      expect(html).toContain('carregando react')
    })
  }
})
