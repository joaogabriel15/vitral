# MCP App

Packages a remote as an [MCP App](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp): an HTML file that an MCP server registers as a `ui://` resource and that MCP hosts (Claude, ChatGPT, VS Code and others) show next to a tool's result. The same remote keeps running in the app.

## Build

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ target: 'mcp-app' })] }
```

`vite build` writes only `dist/mcp-app.html`: the JS (with its dynamic `import()`s) and the CSS go inline, with no external files. To publish both formats, use two `vite.config` files or `mode`:

```js
export default ({ mode }) => ({
  plugins: [react(), vitral(mode === 'mcp' ? { target: 'mcp-app' } : {})],
  build: { outDir: mode === 'mcp' ? 'dist-mcp' : 'dist' },
})
```

`target: 'mcp-app'` doesn't combine with `exposes`, `dedupe` or `shared`, which depend on more than one file.

## MCP server

The server registers the HTML as a resource with `mimeType: 'text/html;profile=mcp-app'` and points the tool to it in `_meta.ui.resourceUri`:

```js
const html = readFileSync('dist/mcp-app.html', 'utf8')

// resources/list and resources/read
{ uri: 'ui://weather/app', name: 'weather', mimeType: 'text/html;profile=mcp-app', text: html }

// tools/list
{ name: 'weather', inputSchema: { … }, _meta: { ui: { resourceUri: 'ui://weather/app' } } }
```

With the official SDK, the same works with `registerAppResource` and `registerAppTool` from `@modelcontextprotocol/ext-apps/server`. The [`examples/mcp-app`](https://github.com/joaogabriel15/vitral/tree/main/examples/mcp-app) example has a stdio server with no dependencies.

## Props

The host sends notifications; they become props, delivered in `mount` and then in `update`:

| Prop | Comes from |
| --- | --- |
| `toolInput` | `ui/notifications/tool-input` (the tool's arguments) |
| `toolInputPartial` | `ui/notifications/tool-input-partial` (arguments still arriving) |
| `toolResult` | `ui/notifications/tool-result` (the `CallToolResult`: `content`, `structuredContent`) |
| `toolCancelled` | `ui/notifications/tool-cancelled` (the reason) |
| `hostContext` | the `ui/initialize` response and `ui/notifications/host-context-changed` (theme, locale, size) |

The remote mounts right after the handshake, before the tool's input: handle a missing `toolInput` and `toolResult`.

```jsx
function Weather({ toolInput, toolResult }) {
  const data = toolResult?.structuredContent
  return <p>{toolInput?.city}: {data ? `${data.temperature} °C` : 'loading'}</p>
}
```

`hostContext.theme` goes to `data-theme` and `color-scheme` on `<html>`, and `hostContext.styles.variables` become CSS variables on `<html>`.

## Events

`ctx.events.emit` becomes a message to the host:

| Event | Message |
| --- | --- |
| `mcp:message` (text or `{ text }`) | `ui/message`: enters the conversation as a user message |
| `mcp:open-link` (URL or `{ url }`) | `ui/open-link` |
| any other | `ui/update-model-context`, with the latest payload of each event in `structuredContent` |

`ctx.navigate(url)` also becomes `ui/open-link`, and `ctx.reportError` becomes `notifications/message` with `level: 'error'`. The content height goes to the host in `ui/notifications/size-changed`. On `ui/resource-teardown`, the remote unmounts.

For the rest of the protocol, `ctx.mcp` speaks JSON-RPC straight to the host:

```js
const result = await ctx.mcp.request('tools/call', { name: 'weather', arguments: { city: 'Lisbon' } })
ctx.mcp.hostContext()?.locale
```

`ctx.mcp` only exists in the MCP App.

## Specification

- [SEP-1865: MCP Apps](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [Extension specification (ext-apps)](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx)

The bridge declares protocol `2026-01-26`, the same as the `@modelcontextprotocol/ext-apps` 2.x SDK.
