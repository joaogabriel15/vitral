// Host Next com Pages Router (withVitral + NextRemote), build de produção com
// webpack, e um remote com `dedupe: ['react']` que usa `import * as React`.
// O manifesto lista todos os nomes do React que o remote lê; a oferta do host
// é o React de produção, que não tem os nomes só de dev (`act`,
// `captureOwnerStack`). O remote tem de usar o React do host, uma cópia só.
import { expect, test } from '@playwright/test'

const HOST = 'http://localhost:4211'

test.describe('host Next (Pages Router) em produção', () => {
  test('remote com import * as React usa o React do host, sem cópia própria', async ({ page }) => {
    const avisos: string[] = []
    page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && avisos.push(m.text()))
    const proprio: string[] = []
    page.on('request', (r) => /_vitral-own/.test(r.url()) && proprio.push(r.url()))

    await page.goto(HOST + '/ns')
    const remote = page.locator('.ns')
    await expect(remote.locator('.versao')).toContainText('React 19')
    // O estado funciona: com duas cópias do React, o useState do remote quebraria.
    await remote.locator('.ping').click()
    await expect(remote.locator('.cliques')).toHaveText('1')

    expect(proprio).toEqual([])
    expect(avisos.filter((a) => /dedupe/.test(a))).toEqual([])
  })

  test('o HTML da página do remote pré-carrega o manifesto e a entrada', async ({ request }) => {
    const html = await (await request.get(HOST + '/ns')).text()
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+href="\/ns-remote\/vitral\.json"/)
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="script"[^>]+integrity="sha384-/)
  })

  test('navegação do host para o remote, sem recarregar', async ({ page }) => {
    await page.goto(HOST + '/')
    await page.evaluate(() => ((window as any).__marca = 1))
    await page.getByRole('link', { name: 'Abrir o remote' }).click()
    await expect(page.locator('.ns .versao')).toContainText('React 19')
    expect(await page.evaluate(() => (window as any).__marca)).toBe(1)
  })
})
