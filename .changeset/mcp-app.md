---
'vitral': minor
---

`vitral({ target: 'mcp-app' })` empacota o remote como MCP App: o build gera `dist/mcp-app.html`, um HTML único com JS e CSS inline, para um servidor MCP registrar como recurso `ui://` (`text/html;profile=mcp-app`). Dentro do host MCP, a entrada e o resultado da tool e o `hostContext` chegam como props, e `ctx.events.emit` vira mensagem para o host (`ui/message`, `ui/open-link` ou `ui/update-model-context`). `ctx.mcp` fala JSON-RPC direto com o host para o resto do protocolo.
