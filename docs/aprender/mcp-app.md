# MCP App

Empacota um remote como [MCP App](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp): um HTML que um servidor MCP registra como recurso `ui://` e que hosts MCP (Claude, ChatGPT, VS Code e outros) mostram junto com o resultado de uma tool. O mesmo remote continua rodando no app.

## Build

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ target: 'mcp-app' })] }
```

`vite build` gera só `dist/mcp-app.html`: o JS (com os `import()` dinâmicos) e o CSS vão inline, sem nenhum arquivo externo. Para publicar os dois formatos, use dois `vite.config` ou `mode`:

```js
export default ({ mode }) => ({
  plugins: [react(), vitral(mode === 'mcp' ? { target: 'mcp-app' } : {})],
  build: { outDir: mode === 'mcp' ? 'dist-mcp' : 'dist' },
})
```

`target: 'mcp-app'` não combina com `exposes`, `dedupe` nem `shared`, que dependem de mais de um arquivo.

## Servidor MCP

O servidor registra o HTML como recurso com `mimeType: 'text/html;profile=mcp-app'` e aponta a tool para ele em `_meta.ui.resourceUri`:

```js
const html = readFileSync('dist/mcp-app.html', 'utf8')

// resources/list e resources/read
{ uri: 'ui://clima/app', name: 'clima', mimeType: 'text/html;profile=mcp-app', text: html }

// tools/list
{ name: 'clima', inputSchema: { … }, _meta: { ui: { resourceUri: 'ui://clima/app' } } }
```

Com o SDK oficial, o mesmo vale com `registerAppResource` e `registerAppTool` de `@modelcontextprotocol/ext-apps/server`. O exemplo [`examples/mcp-app`](https://github.com/joaogabriel15/vitral/tree/main/examples/mcp-app) tem um servidor por stdio sem dependências.

## Props

O host manda notificações; elas viram props, entregues em `mount` e depois em `update`:

| Prop | Vem de |
| --- | --- |
| `toolInput` | `ui/notifications/tool-input` (argumentos da tool) |
| `toolInputPartial` | `ui/notifications/tool-input-partial` (argumentos ainda chegando) |
| `toolResult` | `ui/notifications/tool-result` (o `CallToolResult`: `content`, `structuredContent`) |
| `toolCancelled` | `ui/notifications/tool-cancelled` (o motivo) |
| `hostContext` | resposta do `ui/initialize` e `ui/notifications/host-context-changed` (tema, idioma, tamanho) |

O remote é montado logo depois do handshake, antes da entrada da tool: trate `toolInput` e `toolResult` ausentes.

```jsx
function Clima({ toolInput, toolResult }) {
  const dados = toolResult?.structuredContent
  return <p>{toolInput?.cidade}: {dados ? `${dados.temperatura} °C` : 'carregando'}</p>
}
```

O `hostContext.theme` vai para `data-theme` e `color-scheme` do `<html>`, e `hostContext.styles.variables` vira variáveis CSS no `<html>`.

## Eventos

`ctx.events.emit` vira mensagem para o host:

| Evento | Mensagem |
| --- | --- |
| `mcp:message` (texto ou `{ text }`) | `ui/message`: entra na conversa como mensagem do usuário |
| `mcp:open-link` (URL ou `{ url }`) | `ui/open-link` |
| qualquer outro | `ui/update-model-context`, com o último payload de cada evento em `structuredContent` |

`ctx.navigate(url)` também vira `ui/open-link`, e `ctx.reportError` vira `notifications/message` com `level: 'error'`. A altura do conteúdo vai para o host em `ui/notifications/size-changed`. No `ui/resource-teardown`, o remote é desmontado.

Para o resto do protocolo, `ctx.mcp` fala JSON-RPC direto com o host:

```js
const resultado = await ctx.mcp.request('tools/call', { name: 'clima', arguments: { cidade: 'Lisboa' } })
ctx.mcp.hostContext()?.locale
```

`ctx.mcp` só existe no MCP App.

## Especificação

- [SEP-1865: MCP Apps](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [Especificação da extensão (ext-apps)](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx)

A ponte declara o protocolo `2026-01-26`, o mesmo do SDK `@modelcontextprotocol/ext-apps` 2.x.
