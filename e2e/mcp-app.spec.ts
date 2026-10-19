// MCP App: o exemplo examples/mcp-app (remote React com target: 'mcp-app')
// servido pelo servidor MCP do exemplo, por stdio. O HTML que o servidor
// devolve em resources/read vai para um iframe sandbox (origem opaca, como
// nos hosts de verdade), e um host falso fala o protocolo MCP Apps com ele.
import { expect, test, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const server = fileURLToPath(new URL('../examples/mcp-app/server.mjs', import.meta.url))

/** Cliente JSON-RPC mínimo por stdio. */
function connect(): { call: (method: string, params?: object) => Promise<any>; close: () => void } {
  const child: ChildProcess = spawn(process.execPath, [server], { stdio: ['pipe', 'pipe', 'inherit'] })
  const waiting = new Map<number, (m: any) => void>()
  createInterface({ input: child.stdout! }).on('line', (line) => {
    const m = JSON.parse(line)
    waiting.get(m.id)?.(m)
  })
  let seq = 0
  return {
    call: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++seq
        waiting.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)))
        child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      }),
    close: () => child.kill(),
  }
}

// Host falso: responde ao ui/initialize, manda a entrada e o resultado da
// tool depois do initialized e guarda tudo o que o iframe manda.
const HOST = `
window.recebidas = []
const frame = document.querySelector('iframe')
const send = (m) => frame.contentWindow.postMessage({ jsonrpc: '2.0', ...m }, '*')
window.send = send
window.addEventListener('message', (e) => {
  if (e.source !== frame.contentWindow) return
  const m = e.data
  window.recebidas.push(m)
  if (m.method === 'ui/initialize') {
    send({ id: m.id, result: {
      protocolVersion: m.params.protocolVersion,
      hostInfo: { name: 'host-falso', version: '1.0.0' },
      hostCapabilities: { openLinks: {}, message: { text: {} }, updateModelContext: { text: {} }, logging: {} },
      hostContext: { theme: 'dark', locale: 'pt-BR', styles: { variables: { '--color-text-primary': 'rgb(255, 0, 0)' } } },
    } })
  } else if (m.method === 'ui/notifications/initialized') {
    send({ method: 'ui/notifications/tool-input', params: { arguments: window.toolInput } })
    send({ method: 'ui/notifications/tool-result', params: window.toolResult })
  } else if (m.id !== undefined && m.method) {
    send({ id: m.id, result: {} })
  }
})
`

async function open(page: Page, html: string, toolInput: object, toolResult: object) {
  await page.setContent('<!doctype html><body><iframe sandbox="allow-scripts" style="width:400px;border:0"></iframe></body>')
  await page.evaluate(
    ([host, html, toolInput, toolResult]) => {
      Object.assign(window, { toolInput, toolResult })
      new Function(host as string)()
      document.querySelector('iframe')!.srcdoc = html as string
    },
    [HOST, html, toolInput, toolResult] as const,
  )
}

const received = (page: Page, method: string) =>
  page.evaluate((method) => (window as any).recebidas.filter((m: any) => m.method === method), method)

test('servidor MCP registra a tool e o recurso ui://, e o remote roda no iframe do host', async ({ page }) => {
  const mcp = connect()
  try {
    await mcp.call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'teste', version: '1' } })
    const { tools } = await mcp.call('tools/list')
    expect(tools[0]._meta.ui.resourceUri).toBe('ui://clima/app')
    const { resources } = await mcp.call('resources/list')
    expect(resources).toEqual([{ uri: 'ui://clima/app', name: 'clima', mimeType: 'text/html;profile=mcp-app' }])
    const { contents } = await mcp.call('resources/read', { uri: 'ui://clima/app' })
    expect(contents[0].mimeType).toBe('text/html;profile=mcp-app')
    const result = await mcp.call('tools/call', { name: 'clima', arguments: { cidade: 'Recife' } })

    await open(page, contents[0].text, { cidade: 'Recife' }, result)
    const app = page.frameLocator('iframe')

    // tool-input e tool-result viraram props.
    await expect(app.locator('.cidade')).toHaveText('Recife')
    await expect(app.locator('.temp')).toHaveText('26 °C')

    // Handshake: initialize com nome e versão do protocolo, depois initialized.
    const [init] = await received(page, 'ui/initialize')
    expect(init.params).toMatchObject({ appInfo: { name: 'clima' }, protocolVersion: '2026-01-26' })
    expect(await received(page, 'ui/notifications/initialized')).toHaveLength(1)

    // hostContext: tema e variáveis CSS do host chegam ao remote.
    await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(app.locator('.clima')).toHaveCSS('color', 'rgb(255, 0, 0)')

    // O iframe informa a altura do conteúdo.
    await expect.poll(async () => (await received(page, 'ui/notifications/size-changed')).at(-1)?.params.height).toBeGreaterThan(50)

    // Evento comum → ui/update-model-context; mcp:message → ui/message.
    await app.locator('.favoritar').click()
    await expect.poll(() => received(page, 'ui/update-model-context')).toEqual([
      expect.objectContaining({ params: expect.objectContaining({ structuredContent: { favorito: { cidade: 'Recife' } } }) }),
    ])
    await app.locator('.perguntar').click()
    await expect.poll(() => received(page, 'ui/message')).toEqual([
      expect.objectContaining({ params: { role: 'user', content: [{ type: 'text', text: 'Vai chover em Recife?' }] } }),
    ])

    // Resultado novo: o remote atualiza sem remontar.
    await page.evaluate(() =>
      (window as any).send({ method: 'ui/notifications/tool-result', params: { content: [], structuredContent: { temperatura: 31 } } }),
    )
    await expect(app.locator('.temp')).toHaveText('31 °C')

    // Teardown: o remote desmonta e responde {}.
    await page.evaluate(() => (window as any).send({ id: 99, method: 'ui/resource-teardown', params: { reason: 'fim' } }))
    await expect(app.locator('.clima')).toHaveCount(0)
    await expect.poll(async () => (await page.evaluate(() => (window as any).recebidas)).find((m: any) => m.id === 99)).toEqual({ jsonrpc: '2.0', id: 99, result: {} })
  } finally {
    mcp.close()
  }
})
