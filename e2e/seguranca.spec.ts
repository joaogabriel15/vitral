// Segurança: nada de origem desconhecida, adulterado ou injetado executa.
//
// Casos que entram com outras fases:
// - Fase 1: override de remote (?vitral=nome@url ou localStorage) ignorado em
//   produção sem configure({ devOverrides: true }); `src` escrito no host entra
//   na allowlist, URL vinda de remotes.json não.
// - Fase 4: CSS adulterado não entra (SRI no CSS); chunks com hash próprio; com
//   `base` absoluto, redirecionar a entrada não executa chunk sem verificação.
// - Fase 5: remote com isolate="iframe" não lê parent.document.
import { cdn, CDN_URL, expect, test } from './fixtures/cenario'

const nadaExecutou = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => [(window as any).__execucoes, (window as any).__adulterado])).toEqual([undefined, undefined])

test.describe('allowlist de origens', () => {
  test('origem fora de allowedOrigins dá ORIGIN_BLOCKED sem baixar o JS', async ({ host }) => {
    const pedidos: string[] = []
    host.page.on('request', (r) => pedidos.push(r.url()))
    await host.configure({ remotes: { x: cdn('cartao') }, allowedOrigins: ['http://localhost:4400'] })
    await host.montar('x')
    await host.erro('x', 'ORIGIN_BLOCKED')
    expect(pedidos.filter((u) => u.startsWith(CDN_URL))).toEqual([])
    await nadaExecutou(host.page)
    await host.continuaFuncionando()
  })

  test('manifesto que aponta o JS para outra origem dá ORIGIN_BLOCKED', async ({ host }) => {
    const pedidos: string[] = []
    host.page.on('request', (r) => pedidos.push(r.url()))
    await host.configure({ remotes: { x: cdn('cartao', { manifesto: { entry: 'http://127.0.0.1:4401/evil.js' } }) } })
    await host.montar('x')
    await host.erro('x', 'ORIGIN_BLOCKED')
    expect(pedidos.filter((u) => u.includes('127.0.0.1'))).toEqual([])
  })
})

test.describe('manifesto adulterado', () => {
  /** Integrity do JS original, que o host fixa ao registrar. */
  const original = async (request: import('@playwright/test').APIRequestContext) => (await (await request.get(cdn('cartao'))).json()).integrity as string

  test('com o hash fixado no host, JS e manifesto trocados juntos dão INTEGRITY', async ({ host, request }) => {
    const integrity = await original(request)
    await host.configure({ remotes: { x: { url: cdn('cartao', { adulterado: 'com-manifesto' }), integrity } } })
    await host.montar('x')
    await host.erro('x', 'INTEGRITY')
    await nadaExecutou(host.page)
  })

  test('com o hash fixado no host, manifesto sem integrity não desliga a verificação', async ({ host, request }) => {
    const integrity = await original(request)
    await host.configure({ remotes: { x: { url: cdn('cartao', { adulterado: true, semIntegrity: true }), integrity } } })
    await host.montar('x')
    await host.erro('x', 'INTEGRITY')
    await nadaExecutou(host.page)
  })

  test('integrity em formato desconhecido é erro, não passa em silêncio', async ({ host }) => {
    await host.configure({ remotes: { x: cdn('cartao', { manifesto: { integrity: 'md5-abc' } }) } })
    await host.montar('x')
    await host.erro('x', 'INTEGRITY')
    await nadaExecutou(host.page)
  })
})

test.describe('HTML nas props', () => {
  const ataque = `"><img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`

  test('props do atributo do <vitral-remote> chegam como texto, sem executar', async ({ host }) => {
    await host.configure({ remotes: { x: cdn('texto') } })
    await host.page.evaluate(async (texto) => {
      const { defineVitralElement } = await import('/libs/atual/element.js' as string)
      defineVitralElement()
      const el = document.createElement('vitral-remote')
      el.setAttribute('name', 'x')
      el.setAttribute('props', JSON.stringify({ texto }))
      document.querySelector('#slots')!.append(el)
    }, ataque)
    const remote = host.page.locator('vitral-remote')
    await expect(remote).toHaveAttribute('data-vitral-status', 'ready')
    await expect(remote.locator('.texto')).toHaveText(ataque)
    await expect(remote.locator('.texto')).toHaveAttribute('title', ataque)
    await expect(remote.locator('img, script')).toHaveCount(0)
    expect(await host.page.evaluate(() => (window as any).__xss)).toBeUndefined()
  })

  test('html`` escapa o que é interpolado; só unsafeHTML insere HTML', async ({ host }) => {
    await host.configure({ remotes: { x: cdn('texto') } })
    await host.montar('x', { props: { texto: ataque, confiavel: '<b class="negrito">ok</b>' } })
    await host.pronto('x')
    const remote = host.slot('x')
    await expect(remote.locator('.texto')).toHaveText(ataque)
    await expect(remote.locator('.texto img, .texto script')).toHaveCount(0)
    await expect(remote.locator('.confiavel .negrito')).toHaveText('ok')
    // Props novas passam pelo mesmo escape.
    await host.page.evaluate((texto) => (window as any).slots.get('x').update({ texto }), `<img src=x onerror="window.__xss=3">`)
    await expect(remote.locator('.texto')).toHaveText(`<img src=x onerror="window.__xss=3">`)
    expect(await host.page.evaluate(() => (window as any).__xss)).toBeUndefined()
  })
})
