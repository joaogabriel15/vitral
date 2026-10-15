// Screenshots da demo (catálogo Vue + carrinho React com Tailwind) em escopo e
// Shadow DOM, claro e escuro. Veja playwright.config.ts desta pasta.
//
// Casos que entram com outras fases:
// - Fase 3: o escuro passa a mudar o remote (html.dark espelhado no Shadow DOM,
//   tema do host herdado); hoje o escuro só testa que nada quebra.
import { expect, test } from '@playwright/test'

const MODOS = { escopo: '/', shadow: '/?shadow=carrinho' }

for (const [modo, path] of Object.entries(MODOS)) {
  for (const tema of ['light', 'dark'] as const) {
    test(`host React, ${modo}, ${tema === 'light' ? 'claro' : 'escuro'}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema })
      await page.goto(`http://localhost:5173${path}`)
      if (tema === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'))
      await page.locator('.produto').first().click()
      await expect(page.locator('.carrinho li')).toHaveCount(1)
      await expect(page).toHaveScreenshot(`react-${modo}-${tema}.png`, { fullPage: true })
    })
  }
}

test('host Vue', async ({ page }) => {
  await page.goto('http://localhost:5174')
  await page.locator('.produto').first().click()
  await expect(page.locator('.carrinho li')).toHaveCount(1)
  await expect(page).toHaveScreenshot('vue.png', { fullPage: true })
})
