// isolate: 'reframe': JS num iframe oculto, DOM no shadow root do host.
import { cdn, expect, test } from './fixtures/cenario'

const iframe = 'iframe[data-vitral-reframe]'

test.describe("isolate: 'reframe'", () => {
  test('globals ficam no iframe; CSS, clique, foco, teclado e rota funcionam no host', async ({ host }) => {
    const consoleErros: string[] = []
    host.page.on('console', (m) => m.type() === 'error' && consoleErros.push(m.text()))
    const page = host.page
    await host.configure({ remotes: { r: cdn('reframe') } })
    await host.montar('r', { isolate: 'reframe', props: { texto: 'oi' } })
    await host.pronto('r')
    const slot = host.slot('r')

    // O global do remote não vaza para o host; o iframe é oculto e de mesma origem.
    expect(await page.evaluate(() => (window as any).__global)).toBeUndefined()
    const info = await page.evaluate((sel) => {
      const f = document.querySelector<HTMLIFrameElement>(sel)!
      const w = f.contentWindow as any
      return { global: w.__global, display: getComputedStyle(f).display, ...w.__info }
    }, iframe)
    expect(info).toEqual({ global: 'remote', display: 'none', nasceu: page.url(), mesmaOrigem: true })

    // DOM no shadow root (os locators do Playwright atravessam shadow roots abertos).
    const texto = slot.locator('.texto')
    await expect(texto).toHaveText('oi')
    expect(await slot.locator('[data-vitral-slot]').evaluate((el) => !!el.shadowRoot?.querySelector('.texto'))).toBe(true)
    expect(await page.evaluate(() => document.querySelector('.texto'))).toBeNull()
    // CSS do manifesto e <style> posto no head do remote valem no shadow root.
    await expect(texto).toHaveCSS('color', 'rgb(0, 128, 0)')
    await expect(slot.locator('.botao')).toHaveCSS('color', 'rgb(0, 0, 255)')

    // Clique, foco e teclado no DOM real do host.
    await slot.locator('.botao').click()
    await expect(slot.locator('.botao')).toHaveText('1')
    const campo = slot.locator('.campo')
    await campo.click()
    await page.keyboard.type('abc')
    await expect(campo).toHaveValue('abc')
    expect(
      await page.evaluate((sel) => {
        const d = (document.querySelector<HTMLIFrameElement>(sel)!.contentWindow as any).document
        return d.activeElement?.className
      }, iframe),
    ).toBe('campo')
    await expect(slot.locator('.tecla')).toHaveText('c')

    // Rota: o pushState do remote muda a URL do host; o voltar do host chega ao remote.
    const inicio = new URL(page.url()).pathname
    await page.evaluate((sel) => (document.querySelector<HTMLIFrameElement>(sel)!.contentWindow as any).__ir('/reframe/rota'), iframe)
    await expect(page).toHaveURL(/\/reframe\/rota$/)
    await expect(slot.locator('.rota')).toHaveText('/reframe/rota')
    await page.goBack()
    await expect(slot.locator('.rota')).toHaveText(inicio)
    // navigate() do host (dispara popstate) chega ao remote em todo navegador.
    await page.evaluate(() => (window as any).vitral.navigate('/do-host'))
    await expect(slot.locator('.rota')).toHaveText('/do-host')
    // pushState cru do host só é visível onde há Navigation API (currententrychange).
    if (await page.evaluate(() => 'navigation' in window)) {
      await page.evaluate(() => history.pushState(null, '', '/do-host-cru'))
      await expect(slot.locator('.rota')).toHaveText('/do-host-cru')
    }

    // Desmontar remove o iframe; timer e ouvinte esquecidos pelo remote param.
    await page.evaluate(() => (window as any).slots.get('r').destroy())
    await expect(page.locator(iframe)).toHaveCount(0)
    const [ticks, teclas] = await page.evaluate(() => [(window as any).__ticks, (window as any).__teclas])
    await page.keyboard.press('x')
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => [(window as any).__ticks, (window as any).__teclas])).toEqual([ticks, teclas])
    await host.continuaFuncionando()
    expect(consoleErros).toEqual([])
  })

  test('JS adulterado dá INTEGRITY e nada roda, nem no iframe', async ({ host }) => {
    await host.configure({ remotes: { r: cdn('reframe', { adulterado: true }) } })
    await host.montar('r', { isolate: 'reframe' })
    await host.erro('r', 'INTEGRITY')
    await expect(host.page.locator(iframe)).toHaveCount(0)
    expect(await host.page.evaluate(() => [(window as any).__adulterado, (window as any).__global])).toEqual([undefined, undefined])
    await host.continuaFuncionando()
  })

  test('sem integrity, o iframe importa da URL', async ({ host }) => {
    await host.configure({ remotes: { r: cdn('reframe', { semIntegrity: true }) } })
    await host.montar('r', { isolate: 'reframe' })
    await host.pronto('r')
    await expect(host.slot('r').locator('.texto')).toHaveText('olá')
    expect(await host.page.evaluate(() => (window as any).__global)).toBeUndefined()
  })
})
