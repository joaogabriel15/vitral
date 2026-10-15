// Bateria de rede: cada falha mostra o erro certo naquele remote e o resto da
// página segue funcionando. As falhas vêm do servidor (fixtures/server.mjs),
// então valem igual nos três navegadores.
//
// Casos que entram com outras fases:
// - Fase 4: "Tentar de novo" depois de falha de rede usa o caminho com blob:
//   e nunca repete uma URL que falhou; CSS com SRI (CSS adulterado não entra);
//   manifesto lento não atrasa CSS e chunks (downloads em paralelo).
import { cdn, expect, REDES, test } from './fixtures/cenario'

test.describe('offline', () => {
  test('erro LOAD_FAILED; o remote já montado segue vivo e "tentar de novo" carrega ao voltar a rede', async ({ host, context }) => {
    await host.configure({ remotes: { antes: cdn('cartao'), depois: cdn('cartao') } })
    await host.montar('antes')
    await host.pronto('antes')

    await context.setOffline(true)
    await host.montar('depois')
    await host.erro('depois', 'LOAD_FAILED')
    await host.page.evaluate(() => (window as any).slots.get('antes').update({ texto: 'sem rede' }))
    await expect(host.slot('antes').locator('.cartao')).toHaveText('antes: sem rede')
    await host.continuaFuncionando()

    await context.setOffline(false)
    await host.page.evaluate(() => (window as any).slots.get('depois').retry())
    await host.pronto('depois')
  })
})

test.describe('3G lento', () => {
  test('remotes reais (React e Vue) mostram o carregando e ficam prontos', async ({ host }) => {
    test.setTimeout(60_000)
    await host.configure({ remotes: { react: cdn('ex-react', REDES['3G lento']), vue: cdn('ex-vue', REDES['3G lento']) } })
    await host.montar('react', { props: { mensagem: 'olá' } })
    await host.montar('vue', { props: { mensagem: 'olá' } })
    await expect(host.slot('react')).toHaveAttribute('data-status', 'loading')
    await host.continuaFuncionando()
    for (const [name, fw] of [['react', 'React'], ['vue', 'Vue']]) {
      await expect(host.slot(name)).toHaveAttribute('data-status', 'ready', { timeout: 30_000 })
      await expect(host.slot(name).locator('.fw')).toHaveText(fw)
    }
  })
})

test.describe('HTTP 500', () => {
  test('manifesto com 500 vira LOAD_FAILED com o status, e "tentar de novo" carrega quando o CDN volta', async ({ host }) => {
    await host.configure({ remotes: { ok: cdn('cartao'), falho: cdn('cartao', { status: { manifesto: 500 }, vezes: 1 }) } })
    await host.montar('ok')
    await host.montar('falho')
    await host.erro('falho', 'LOAD_FAILED')
    await expect(host.slot('falho')).toHaveAttribute('data-erro', /HTTP 500/)
    await host.pronto('ok')
    await host.continuaFuncionando()
    await host.page.evaluate(() => (window as any).slots.get('falho').retry())
    await host.pronto('falho')
  })

  test('JS com 500 é tentado de novo sozinho (retries) e carrega', async ({ host }) => {
    await host.configure({ remotes: { x: cdn('cartao', { status: { js: 500 }, vezes: 1 }) }, retries: 1 })
    await host.montar('x')
    await host.pronto('x')
  })
})

test.describe('JS adulterado (SRI)', () => {
  test('erro INTEGRITY com esperado e obtido, e nada do arquivo executa', async ({ host }) => {
    await host.configure({ remotes: { ok: cdn('cartao'), adulterado: cdn('cartao', { adulterado: true }) } })
    await host.montar('adulterado')
    await host.erro('adulterado', 'INTEGRITY')
    await expect(host.slot('adulterado')).toHaveAttribute('data-erro', /esperado sha384-.+, obtido sha384-/)
    expect(await host.page.evaluate(() => [(window as any).__adulterado, (window as any).__execucoes])).toEqual([undefined, undefined])
    await host.montar('ok')
    await host.pronto('ok')
    await host.continuaFuncionando()
  })
})

test.describe('CDN lento', () => {
  test('JS acima do timeout vira TIMEOUT, sem travar a página', async ({ host }) => {
    await host.configure({ remotes: { lento: cdn('cartao', { atraso: { js: 5_000 } }) }, timeout: 1_000, retries: 0 })
    await host.montar('lento')
    await host.continuaFuncionando()
    await host.erro('lento', 'TIMEOUT')
  })

  test('manifesto acima do timeout vira TIMEOUT', async ({ host }) => {
    await host.configure({ remotes: { lento: cdn('cartao', { atraso: { manifesto: 5_000 } }) }, timeout: 1_000, retries: 0 })
    await host.montar('lento')
    await host.erro('lento', 'TIMEOUT')
  })

  test('sem integrity (import direto), o timeout também vale', async ({ host }) => {
    await host.configure({ remotes: { lento: cdn('cartao', { semIntegrity: true, atraso: { js: 5_000 } }) }, timeout: 1_000, retries: 0 })
    await host.montar('lento')
    await host.erro('lento', 'TIMEOUT')
  })

  test('lento só na primeira vez: o retry com espera carrega', async ({ host }) => {
    await host.configure({ remotes: { x: cdn('cartao', { atraso: { js: 5_000 }, vezes: 1 }) }, timeout: 1_000, retries: 1 })
    await host.montar('x')
    await host.pronto('x')
    await expect(host.slot('x').locator('.cartao')).toHaveText('x: olá')
  })
})

test.describe('CORS ausente', () => {
  test('manifesto sem CORS vira LOAD_FAILED', async ({ host }) => {
    await host.configure({ remotes: { x: cdn('cartao', { semCors: 'manifesto' }) } })
    await host.montar('x')
    await host.erro('x', 'LOAD_FAILED')
    await host.continuaFuncionando()
  })

  test('JS sem CORS vira LOAD_FAILED, com e sem integrity', async ({ host }) => {
    await host.configure({
      remotes: { sri: cdn('cartao', { semCors: 'js' }), direto: cdn('cartao', { semCors: 'js', semIntegrity: true }) },
      retries: 0,
    })
    await host.montar('sri')
    await host.montar('direto')
    await host.erro('sri', 'LOAD_FAILED')
    await host.erro('direto', 'LOAD_FAILED')
    expect(await host.page.evaluate(() => (window as any).__execucoes)).toBeUndefined()
  })

  test('CSS sem CORS não impede o remote de aparecer (sem o estilo)', async ({ host }) => {
    const verde = 'rgb(0, 128, 0)'
    await host.configure({ remotes: { com: cdn('cartao'), sem: cdn('cartao', { semCors: 'css' }), semShadow: cdn('cartao', { semCors: 'css' }) } })
    await host.montar('com', { isolate: 'shadow' })
    await host.montar('sem')
    await host.montar('semShadow', { isolate: 'shadow' })
    for (const name of ['com', 'sem', 'semShadow']) await host.pronto(name)
    await expect(host.slot('com').locator('.cartao')).toHaveCSS('color', verde)
    await expect(host.slot('sem').locator('.cartao')).not.toHaveCSS('color', verde)
    await expect(host.slot('semShadow').locator('.cartao')).not.toHaveCSS('color', verde)
  })
})
