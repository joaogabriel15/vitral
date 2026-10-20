---
'vitral': minor
---

`vitral/edge`: gateway de edge que serve host e remotes de uma origem só (`/_vitral/<nome>/…`, com o `vitral.json` reescrito e os mesmos hashes), manda `Link` para Early Hints e faz SSR opcional dos remotes em Declarative Shadow DOM. Roda em Cloudflare Workers (com `HTMLRewriter`) e em Node, Deno e Bun (`toNodeListener` para o Node). Contrato novo e opcional no remote: `render(props)` no servidor e `hydrate(el, props, ctx)` no navegador; o `<vitral-remote>` hidrata o HTML do servidor em vez de montar de novo. Sem `hydrate`, nada muda.
