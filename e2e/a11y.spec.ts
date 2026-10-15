// Acessibilidade: axe (WCAG 2.1 A e AA) nos estados de carregando e de erro de cada host.
//
// Casos que entram com outras fases:
// - Fase 1: carregando e erro padrão do <vitral-remote> (sem slots), com
//   role="status"/aria-live e botão "Tentar de novo" acessível.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { HOSTS } from './hosts'

const REMOTES = 'http://localhost:4100/**'

async function semViolacoes(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

for (const [host, port] of Object.entries(HOSTS)) {
  test.describe(`host ${host}`, () => {
    test('carregando', async ({ page }) => {
      // Os remotes nunca respondem: a página fica no estado de carregando.
      let pedido: () => void
      const pedidos = new Promise<void>((r) => (pedido = r))
      await page.route(REMOTES, () => pedido())
      await page.goto(`http://localhost:${port}`)
      await pedidos
      await expect(page.locator('h1')).toBeVisible()
      await semViolacoes(page)
    })

    test('erro', async ({ page }) => {
      await page.goto(`http://localhost:${port}`)
      await expect(page.locator('[data-remote="quebrado"] .erro')).toBeVisible()
      await semViolacoes(page)
    })
  })
}
