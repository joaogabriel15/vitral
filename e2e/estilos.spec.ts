// Estilos do host no remote (examples/estilos): tema do Tailwind v4, dark mode,
// fontes, CSS legado e Tailwind v3 na mesma página, em escopo e Shadow DOM.
// O remote "opcoes" usa theme: 'host', layers: 'flatten' e
// renameRegisteredProperties; o "padrao" não usa nenhuma e mostra o problema.
import { expect, test, type Page } from '@playwright/test'

const HOST = 'http://localhost:4311'
const MODES = { escopo: '', 'Shadow DOM': '&isolate=shadow' }

async function open(page: Page, path: string) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(HOST + path)
  await expect(page.locator('body')).toHaveAttribute('data-status', 'ready')
  return errors
}

// Valor calculado de um elemento do remote, esteja ele no documento ou no shadow root.
function css(page: Page, selector: string, prop: string): Promise<string> {
  return page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel) ?? document.querySelector('[data-vitral-slot]')!.shadowRoot!.querySelector(sel)!
      return getComputedStyle(el).getPropertyValue(p)
    },
    [selector, prop],
  )
}

const width = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel) ?? document.querySelector('[data-vitral-slot]')!.shadowRoot!.querySelector(sel)!
    return el.getBoundingClientRect().width
  }, selector)

const toggleDark = (page: Page) => page.evaluate(() => document.documentElement.classList.toggle('dark'))

for (const [mode, query] of Object.entries(MODES)) {
  test.describe(`modo ${mode}`, () => {
    test('com theme: host, o botão do remote usa a cor da marca do host', async ({ page }) => {
      const errors = await open(page, `/?remote=opcoes${query}`)
      const host = await css(page, '#ref', 'background-color')
      expect(await css(page, '#botao', 'background-color')).toBe(host)
      expect(errors).toEqual([])
    })

    test('trocar html.dark muda o remote: variável do host e utilitário dark:', async ({ page }) => {
      await open(page, `/?remote=opcoes${query}`)
      const claro = await css(page, '#ref', 'background-color')
      expect(await css(page, '#tema', 'background-color')).toBe('rgb(255, 255, 255)')
      await toggleDark(page)
      const escuro = await css(page, '#ref', 'background-color')
      expect(escuro).not.toBe(claro)
      await expect.poll(() => css(page, '#botao', 'background-color')).toBe(escuro)
      await expect.poll(() => css(page, '#tema', 'background-color')).toBe('rgb(0, 0, 0)')
      await toggleDark(page)
      await expect.poll(() => css(page, '#tema', 'background-color')).toBe('rgb(255, 255, 255)')
      expect(await css(page, '#botao', 'background-color')).toBe(claro)
    })

    test('fonte própria do remote e fonte importada de outra origem carregam e são usadas', async ({ page }) => {
      await open(page, `/?remote=opcoes${query}`)
      for (const family of ['Remota', 'Externa']) {
        await expect
          .poll(() =>
            page.evaluate(async (f) => {
              await document.fonts.load(`16px ${f}`)
              const face = [...document.fonts].find((x) => x.family.replace(/"/g, '') === f)
              return face?.status === 'loaded' && document.fonts.check(`16px ${f}`)
            }, family),
          )
          .toBe(true)
      }
      // Cada letra da fonte de teste tem 3 em: o texto fica bem mais largo.
      const normal = await width(page, '#padrao')
      await expect.poll(() => width(page, '#fonte')).toBeGreaterThan(normal * 2)
      await expect.poll(() => width(page, '#externa')).toBeGreaterThan(normal * 2)
    })

    test('host com Tailwind v3 mantém os gradientes com renameRegisteredProperties', async ({ page }) => {
      await open(page, `/v3.html?remote=opcoes${query}`)
      expect(await page.locator('#host-gradiente').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('rgb(255, 255, 255)')
      expect(await css(page, '#gradiente', 'background-image')).toContain('linear-gradient')
    })
  })
}

test.describe('sem as opções (o problema que elas resolvem)', () => {
  test('sem theme: host, o tema do remote vence o do host', async ({ page }) => {
    await open(page, '/?remote=padrao')
    expect(await css(page, '#botao', 'background-color')).not.toBe(await css(page, '#ref', 'background-color'))
  })

  test('sem renameRegisteredProperties, o gradiente do host Tailwind v3 some', async ({ page }) => {
    await open(page, '/v3.html?remote=padrao')
    expect(await page.locator('#host-gradiente').evaluate((el) => getComputedStyle(el).backgroundImage)).not.toContain('rgb(255, 255, 255)')
  })

  test('sem layers: flatten, o CSS legado do host pinta o botão do remote', async ({ page }) => {
    await open(page, '/legado.html?remote=padrao')
    expect(await css(page, '#botao', 'background-color')).toBe('rgb(0, 128, 0)')
  })

  test('sem mirrorTheme, dark: não funciona no Shadow DOM', async ({ page }) => {
    await open(page, '/?remote=opcoes&isolate=shadow&mirror=0&dark')
    expect(await css(page, '#tema', 'background-color')).toBe('rgb(255, 255, 255)')
  })
})

test('CSS legado do host não sobrepõe o remote com layers: flatten', async ({ page }) => {
  await open(page, '/legado.html?remote=opcoes')
  const bg = await css(page, '#botao', 'background-color')
  expect(bg).not.toBe('rgb(0, 128, 0)')
  expect(bg).not.toBe('rgba(0, 0, 0, 0)')
})

test('styles.inherit adota o CSS base do host no Shadow DOM', async ({ page }) => {
  await open(page, '/?remote=opcoes&isolate=shadow')
  expect(await css(page, '#base', 'text-decoration-line')).toBe('none')
  await open(page, '/?remote=opcoes&isolate=shadow&base')
  expect(await css(page, '#base', 'text-decoration-line')).toBe('underline')
})
