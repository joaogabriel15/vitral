// Deploy no meio da sessão: o CDN serve a v1, a página abre, a v2 é publicada.
//
// Casos que entram com outras fases:
// - Fase 5: com configure({ updates: 'on-navigate' }), navegar revalida o
//   manifesto, emite vitral:update-available e refresh('app') troca para a v2
//   mantendo as props, sem recarregar a página.
import { CDN_URL, expect, test } from './fixtures/cenario'

let seq = 0
const novoDeploy = () => `d${process.pid}-${Date.now()}-${seq++}`

test('página aberta segue com a v1 e remontar não quebra, mesmo com a v1 apagada do CDN', async ({ host, request }) => {
  const id = novoDeploy()
  await host.configure({ remotes: { app: `${CDN_URL}/deploy/${id}/vitral.json` } })
  await host.montar('app')
  await expect(host.slot('app').locator('.versao')).toHaveText('v1')

  expect((await request.post(`${CDN_URL}/__deploy/${id}?versao=2&apagar=1`)).ok()).toBe(true)
  await host.page.evaluate(() => (window as any).vitral.navigate('/outra-rota'))
  await expect(host.page).toHaveURL(/\/outra-rota$/)
  await host.page.evaluate(() => (window as any).slots.get('app').retry())
  await host.pronto('app')
  await expect(host.slot('app').locator('.versao')).toHaveText('v1')
  expect(await host.page.evaluate(() => (window as any).__versoes)).toEqual([1])
  await host.continuaFuncionando()
})

test('recarregar pega a v2: o manifesto sempre revalida e o JS antigo em cache não atrapalha', async ({ host, request }) => {
  const id = novoDeploy()
  const remotes = { app: `${CDN_URL}/deploy/${id}/vitral.json` }
  await host.configure({ remotes })
  await host.montar('app')
  await expect(host.slot('app').locator('.versao')).toHaveText('v1')

  await request.post(`${CDN_URL}/__deploy/${id}?versao=2`)
  await host.recarregar()
  await host.configure({ remotes })
  await host.montar('app')
  await expect(host.slot('app').locator('.versao')).toHaveText('v2')
  expect(await host.page.evaluate(() => (window as any).__versoes)).toEqual([2])
})
