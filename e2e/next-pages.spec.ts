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

  test('manifesto do servidor: o HTML pré-carrega a entrada e o navegador não pede o vitral.json', async ({ page, request }) => {
    const html = await (await request.get(HOST + '/ns-servidor')).text()
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="script"[^>]+integrity="sha384-/)
    expect(html).not.toMatch(/rel="preload"[^>]+href="\/ns-remote\/vitral\.json"/)
    const pedidos: string[] = []
    page.on('request', (r) => /vitral\.json/.test(r.url()) && pedidos.push(r.url()))
    await page.goto(HOST + '/ns-servidor')
    const remote = page.locator('.ns')
    await remote.locator('.ping').click()
    await expect(remote.locator('.cliques')).toHaveText('1')
    expect(pedidos).toEqual([])
  })

  test('SSR do remote: o HTML sai pronto com o estado do servidor, e o navegador hidrata no mesmo nó', async ({ page, request }) => {
    const html = await (await request.get(HOST + '/ns-ssr')).text()
    expect(html).toContain('data-vitral-ssr')
    expect(html).toMatch(/class="cliques">5</)
    expect(html).toContain('data-vitral-state')
    const erros: string[] = []
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    page.on('pageerror', (e) => erros.push(String(e)))
    await page.goto(HOST + '/ns-ssr', { waitUntil: 'domcontentloaded' })
    // O botão do servidor, marcado antes da hidratação.
    await page.evaluate(() => ((document.querySelector('.ping') as any).__servidor = 1))
    const remote = page.locator('.ns')
    await expect(page.locator('[data-vitral-status="ready"]')).toHaveCount(1)
    await remote.locator('.ping').click()
    await expect(remote.locator('.cliques')).toHaveText('6')
    expect(await page.evaluate(() => (document.querySelector('.ping') as any).__servidor)).toBe(1)
    await expect(remote).toHaveCount(1)
    // Sem diferença entre o HTML do servidor e o do navegador (o teste do SRI deixa a linha dele, que não conta).
    expect(erros.filter((e) => /hydrat|#418|#423|#425|did not match/i.test(e))).toEqual([])
  })

  test('página que só desenha o remote depois do login: o HTML já pré-carrega o manifesto e a entrada', async ({ page, request, browserName }) => {
    const html = await (await request.get(HOST + '/ns-login')).text()
    expect(html).not.toContain('class="carregando"')
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+href="\/ns-remote\/vitral\.json"/)
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="script"[^>]+integrity="sha384-/)
    const pedidos: string[] = []
    page.on('request', (r) => /vitral\.json/.test(r.url()) && pedidos.push(r.url()))
    await page.goto(HOST + '/ns-login')
    await expect(page.locator('.ns .versao')).toContainText('React 19')
    // Chromium e Firefox: um download só, o fetch do manifesto usa o preload do HTML.
    // O WebKit nunca entrega um preload as=fetch ao fetch() (testado com cada
    // combinação de crossorigin, credentials, cache e signal): lá o fetch é um
    // segundo pedido, que o cache HTTP do navegador pode responder.
    const tipos = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /vitral\.json/.test(e.name)).map((e) => (e as PerformanceResourceTiming).initiatorType))
    expect(tipos).toEqual(browserName === 'webkit' ? ['link', 'fetch'] : ['link'])
    if (browserName !== 'webkit') expect(pedidos).toHaveLength(1)
  })

  test('traduções do remote: o HTML pré-carrega só a língua aberta, e a troca de língua baixa a outra', async ({ page, request, browserName }) => {
    const html = await (await request.get(HOST + '/ns-i18n')).text()
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="fetch"[^>]+href="\/ns-remote\/i18n\/pt-BR\/ns-[^"]+\.json"/)
    expect(html).not.toMatch(/\/ns-remote\/i18n\/en\//)
    const avisos: string[] = []
    page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && /i18n|tradu|preload/i.test(m.text()) && avisos.push(m.text()))
    await page.goto(HOST + '/ns-i18n')
    const titulo = page.locator('.ns .titulo')
    await expect(titulo).toHaveText('Minha conta')
    // O remote usa o i18next do host: a troca no host vale no remote.
    await page.locator('.lingua').click()
    await expect(titulo).toHaveText('My account')
    const tipos = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/i18n\//.test(e.name)).map((e) => [e.name.split('/i18n/')[1].split('/')[0], (e as PerformanceResourceTiming).initiatorType]))
    // Chromium e Firefox usam o preload; o WebKit pede de novo (ver o teste do manifesto).
    expect(tipos).toEqual(browserName === 'webkit' ? [['pt-BR', 'link'], ['pt-BR', 'fetch'], ['en', 'fetch']] : [['pt-BR', 'link'], ['en', 'fetch']])
    expect(avisos).toEqual([])
  })

  test('falha de rede com a CSP sem blob:: "Tentar de novo" baixa de novo e monta', async ({ page, browserName }) => {
    // Só o Chromium aplica a CSP do header de um fulfill do Playwright do mesmo jeito que a de um servidor.
    test.skip(browserName !== 'chromium', 'CSP por route só no Chromium')
    await page.route(HOST + '/ns-erro', async (r) => {
      const res = await r.fetch()
      await r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval'" } })
    })
    let fora = true
    await page.route(/\/ns-remote\/.*\.js$/, (r) => (fora ? r.abort('connectionrefused') : r.continue()))
    await page.goto(HOST + '/ns-erro')
    const erro = page.locator('.erro')
    await expect(erro).toContainText('LOAD_FAILED')
    fora = false
    await erro.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page.locator('.ns .versao')).toContainText('React 19')
  })
})
