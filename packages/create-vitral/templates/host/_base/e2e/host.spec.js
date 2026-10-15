import { expect, test } from '@playwright/test'

// Suba o remote antes: npm run dev na pasta dele (__SRC__).
test('o host mostra o remote', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Olá, host' })).toBeVisible()
})
