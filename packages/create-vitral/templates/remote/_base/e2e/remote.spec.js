import { expect, test } from '@playwright/test'

test('o remote monta e responde ao clique', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Olá, dev' })).toBeVisible()
  await page.getByRole('button').click()
  await expect(page.getByRole('button')).toHaveText('Cliques: 1')
})
