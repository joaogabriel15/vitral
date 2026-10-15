// Recursos opcionais no host sem framework (:4210): partes de um remote,
// loadModule, rotas, iframe e atualização sem reload.
import { expect, test, type Page } from '@playwright/test'

const HOST = 'http://localhost:4210'
const LOJA = 'http://localhost:4100/loja/'

async function open(page: Page, path = '/') {
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.goto(HOST + path)
  // Marca a página: se ela recarregar, a marca some.
  await page.evaluate(() => ((window as any).__marca = 1))
  return erros
}

test('parte exposta (loja/MiniCarrinho) e loadModule dividem o mesmo estado', async ({ page }) => {
  const erros = await open(page, '/rotas/loja')
  const mini = page.locator('#partes .mini')
  await expect(mini).toHaveText('itens: 0')
  await page.locator('#adicionar').click()
  await expect(page.locator('#itens-api')).toHaveText('1')
  await expect(mini).toHaveText('itens: 1')
  // O remote inteiro, montado pela rota, vê o mesmo estado.
  await expect(page.locator('vitral-outlet .total')).toHaveText('total: 1')
  await page.locator('vitral-outlet .comprar').click()
  await expect(mini).toHaveText('itens: 2')
  expect(erros).toEqual([])
})

test('rotas: o outlet troca de remote pelos links, sem recarregar, e volta', async ({ page }) => {
  await open(page)
  const outlet = page.locator('vitral-outlet')
  await expect(outlet.locator('.vazio')).toBeVisible()
  await page.locator('nav a[href="/rotas/loja"]').click()
  await expect(outlet.locator('.titulo')).toHaveText('Loja na rota')
  await expect(page).toHaveURL(HOST + '/rotas/loja')
  await page.locator('nav a[href="/rotas/conta"]').click()
  await expect(outlet.locator('.fw')).toHaveText('Vanilla TS')
  await expect(outlet.locator('.msg')).toHaveText('olá')
  await expect(outlet.locator('.loja')).toHaveCount(0)
  await page.goBack()
  await expect(outlet.locator('.titulo')).toHaveText('Loja na rota')
  await page.goBack()
  await expect(outlet.locator('.vazio')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__marca)).toBe(1)
})

test('rota aberta direto pela URL monta o remote certo', async ({ page }) => {
  await open(page, '/rotas/conta')
  await expect(page.locator('vitral-outlet .fw')).toHaveText('Vanilla TS')
})

test('iframe: o remote não lê parent.document nem o storage e não suja o window do host', async ({ page }) => {
  const erros = await open(page)
  const iframe = page.locator('#parceiro iframe')
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  const frame = page.frameLocator('#parceiro iframe')
  await expect(frame.locator('.documento')).toHaveText('bloqueado')
  await expect(frame.locator('.storage')).toHaveText('bloqueado')
  await expect(page.locator('#intruso-documento')).toHaveText('bloqueado')
  expect(await page.evaluate(() => (window as any).__intruso)).toBeUndefined()
  // Altura automática.
  await expect.poll(async () => (await iframe.boundingBox())?.height ?? 0).toBeGreaterThan(40)
  expect(erros).toEqual([])
})

test('iframe: props e eventos passam pela ponte; navegação para fora é bloqueada', async ({ page }) => {
  await open(page)
  const frame = page.frameLocator('#parceiro iframe')
  await expect(frame.locator('.msg')).toHaveText('olá')
  await page.locator('#mensagem').fill('oi do host')
  await expect(frame.locator('.msg')).toHaveText('oi do host')
  await frame.locator('.ping').click()
  await expect(page.locator('#ultimo-ping')).toHaveText('Intruso')
  await frame.locator('.fora').click()
  await page.waitForTimeout(200)
  expect(page.url().startsWith(HOST)).toBe(true)
})

test('atualização sem reload: publica a v2 com a página aberta e troca o remote', async ({ page }) => {
  await open(page)
  await expect(page.locator('#partes .mini')).toHaveText('itens: 0')

  // "Publica" a v2: o manifesto passa a apontar para um JS novo.
  const v2 = `export default { mount(el) { el.innerHTML = '<p class="loja-v2">loja v2</p>'; return { unmount() {} } } }
export const exposes = { './MiniCarrinho': { default: { mount(el) { el.innerHTML = '<p class="mini">mini v2</p>'; return { unmount() {} } } } } }`
  const cors = { 'access-control-allow-origin': '*' }
  await page.route(LOJA + 'remote-v2.js', (r) => r.fulfill({ body: v2, contentType: 'text/javascript', headers: cors }))
  await page.route(LOJA + 'vitral.json', (r) =>
    r.fulfill({ body: JSON.stringify({ name: 'loja', version: '2.0.0', entry: 'remote-v2.js' }), contentType: 'application/json', headers: cors }),
  )

  // Navegar revalida os manifestos.
  await page.locator('nav a[href="/rotas/conta"]').click()
  await expect(page.locator('#atualizacao')).toHaveText('loja')
  await expect(page.locator('#partes .mini')).toHaveText('itens: 0')

  await page.locator('#atualizar').click()
  await expect(page.locator('#atualizacao')).toHaveText('atualizado')
  await expect(page.locator('#partes .mini')).toHaveText('mini v2')
  expect(await page.evaluate(() => (window as any).__marca)).toBe(1)
})
