// Uso sem build: uma página HTML com `vitral/auto` e `<vitral-remote src>`,
// sem configure(). O teste serve a página (:4299), o dist da lib e o remote
// React dos exemplos (:4298, outra origem) direto do disco.
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const types: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' }

async function open(page: Page, body: string) {
  await page.route(/^http:\/\/localhost:(4298|4299)\//, async (route) => {
    const url = new URL(route.request().url())
    if (url.port === '4299' && url.pathname === '/') {
      const html = `<!doctype html><meta charset="utf-8"><script type="module" src="/vitral/auto.js"></script>${body}`
      return route.fulfill({ body: html, contentType: 'text/html' })
    }
    const file =
      url.port === '4299'
        ? join(root, 'packages/vitral/dist', url.pathname.replace('/vitral/', ''))
        : join(root, 'examples/remotes', url.pathname.split('/')[1], 'dist', ...url.pathname.split('/').slice(2))
    try {
      const data = await readFile(file)
      return route.fulfill({ body: data, contentType: types[extname(file)], headers: { 'access-control-allow-origin': '*' } })
    } catch {
      return route.fulfill({ status: 404, body: 'not found', headers: { 'access-control-allow-origin': '*' } })
    }
  })
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.goto('http://localhost:4299/')
  return erros
}

test('duas linhas no host: script do auto e src com o manifesto', async ({ page }) => {
  const erros = await open(page, `<vitral-remote src="http://localhost:4298/react/vitral.json" props='{"mensagem":"olá"}'></vitral-remote>`)
  await expect(page.locator('vitral-remote .fw')).toHaveText('React')
  await expect(page.locator('vitral-remote .msg')).toHaveText('olá')
  await expect(page.locator('vitral-remote')).toHaveAttribute('data-vitral-status', 'ready')
  expect(erros).toEqual([])
})

test('sem slots, mostra o erro padrão com "Tentar de novo"', async ({ page }) => {
  await open(page, `<vitral-remote src="http://localhost:4298/nao-existe/vitral.json"></vitral-remote>`)
  const alerta = page.getByRole('alert')
  await expect(alerta).toContainText('Não foi possível carregar.')
  await alerta.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})
