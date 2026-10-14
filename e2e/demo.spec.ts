// Demo da raiz (catálogo Vue + carrinho React com Tailwind).
import { expect, test } from '@playwright/test'

const find = (sel: string) =>
  `document.querySelector('${sel}') || [...document.querySelectorAll('[data-vitral] > div')].map((d) => d.shadowRoot && d.shadowRoot.querySelector('${sel}')).find(Boolean)`

for (const url of ['http://localhost:5173', 'http://localhost:5173/?shadow=carrinho']) {
  test.describe(url.includes('shadow') ? 'Tailwind em Shadow DOM' : 'Tailwind sem Shadow DOM', () => {
    test('valores arbitrários e sombras funcionam e o CSS do remote não vaza no host', async ({ page }) => {
      await page.goto(url)
      await page.locator('#tw-arbitrario').waitFor()
      const r = await page.evaluate(`(() => {
        const cs = getComputedStyle(${find('#tw-arbitrario')})
        const h1 = getComputedStyle(document.querySelector('h1'))
        return { h: cs.height, w: cs.width, shadow: cs.boxShadow, h1: h1.fontSize, semUnidade: getComputedStyle(${find('#tw-sem-unidade')}).height }
      })()`)
      expect(r).toMatchObject({ h: '37px', w: '123px', h1: '32px', semUnidade: '10px' })
      expect((r as any).shadow).toContain('10px 15px')
    })
  })
}

test('catálogo (Vue, Shadow DOM) conversa com o carrinho (React) e o host', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.locator('.produto').first().click()
  await page.locator('.produto').nth(2).click()
  await expect(page.locator('.carrinho li')).toHaveCount(2)
  await expect(page.locator('#badge')).toHaveText('🛒 2')
  // O CSS genérico do catálogo (button verde) não vaza para o host
  const bg = await page.evaluate(() => getComputedStyle([...document.querySelectorAll('button')].pop()!).backgroundColor)
  expect(bg).not.toBe('rgb(66, 184, 131)')
})

test('erro de render no remote vira tela de erro só daquele remote, com recarregar', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.locator('#quebrar').click()
  await expect(page.locator('#erro-carrinho')).toContainText('RENDER_FAILED')
  await expect(page.locator('.produto').first()).toBeVisible()
  await page.getByText('Recarregar carrinho').click()
  await expect(page.locator('.carrinho')).toBeVisible()
})

test('host Vue também carrega os remotes da demo', async ({ page }) => {
  await page.goto('http://localhost:5174')
  await page.locator('.produto').first().click()
  await expect(page.locator('.carrinho li')).toHaveCount(1)
  await page.locator('#titulo').fill('Novo título')
  await expect(page.locator('.carrinho h2')).toContainText('Novo título')
})
