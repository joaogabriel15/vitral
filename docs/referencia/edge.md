# vitral/edge

Gateway que serve o host e os remotes de uma origem só. Roda no edge (Cloudflare Workers) e em Node, Deno e Bun.

```ts
gateway(options: GatewayOptions): Gateway   // (request: Request) => Promise<Response>
toNodeListener(handler): (req, res) => void  // para http.createServer
```

O que ele faz:

- `/_vitral/<nome>/<caminho>` vai para a pasta do remote no CDN. O `vitral.json` sai com as URLs absolutas do CDN trocadas por caminhos desta origem. Os hashes de SRI não mudam: os bytes são os mesmos.
- O resto vai para `origin`, o app do host.
- No HTML, `<vitral-remote src="https://cdn…/vitral.json">` passa a apontar para `/_vitral/…`.
- A resposta HTML ganha `Link` com os arquivos dos remotes da página (Early Hints).
- Remote com `render` sai renderizado no HTML, em Declarative Shadow DOM. Veja [SSR](../aprender/ssr#ssr-do-remote-pelo-gateway).
- Com `routes`, o `<vitral-outlet>` recebe o remote da rota da URL, já renderizado, e a resposta já leva o `Link` dele na primeira visita. Veja [Rotas com SSR](../aprender/ssr#rotas-com-ssr).

Só usa APIs Web e nenhuma dependência. Onde existe `HTMLRewriter` (Cloudflare Workers), usa ele. Nos outros runtimes, usa um rewriter próprio em streaming.

## Cloudflare Workers

```ts
// worker.ts
import { gateway } from 'vitral/edge'
import { render as carrinho } from 'carrinho/server'

const handler = gateway({
  origin: 'https://app.empresa.com',
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/vitral.json', render: carrinho },
    busca: 'https://cdn.empresa.com/busca/vitral.json',
  },
  isolate: 'shadow',
})

export default { fetch: handler }
```

Ligue **Early Hints** na zona: a Cloudflare guarda os `Link` das respostas e manda `103` nas próximas visitas.

## Node

```ts
// gateway.mjs
import { createServer } from 'node:http'
import { gateway, toNodeListener } from 'vitral/edge'

const handler = gateway({
  origin: 'http://localhost:3000',
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})

createServer(toNodeListener(handler)).listen(8080)
```

`toNodeListener` manda `103 Early Hints` (`res.writeEarlyHints`) antes de buscar a página.

Deno e Bun aceitam o handler direto:

```ts
Deno.serve(handler)
Bun.serve({ fetch: handler })
```

## No host

Registre os remotes pelo caminho do gateway:

```ts
configure({ remotes: { carrinho: '/_vitral/carrinho/vitral.json' } })
```

Com `<vitral-remote src="https://cdn…">` no HTML, o gateway já troca o `src`.

## Opções

| Opção | O que faz |
| --- | --- |
| `origin` | Origem do host. Obrigatória |
| `remotes` | `{ nome: url }` ou `{ nome: { url, render?, isolate? } }`. `url` é o `vitral.json` (ou o JS) no CDN |
| `prefix` | Prefixo dos caminhos dos remotes. Padrão `/_vitral/` |
| `isolate` | Isolamento do SSR quando a tag não tem `isolate` (o mesmo do `configure` do host). Padrão `'none'` |
| `preload(url)` | Nomes dos remotes desta URL, para mandar `Link` já na primeira visita |
| `routes` | O mesmo mapa de [`routes()`](./routes) do cliente. O remote da rota sai renderizado no `<vitral-outlet>` e entra no `Link` já na primeira visita |
| `fetch` | `fetch` usado para falar com o host e os CDNs |
| `ttl` | Por quanto tempo manifestos e CSS ficam em memória, em ms. Padrão `60000` |
| `onError(erro, nome)` | Erro no SSR de um remote. A página sai sem o SSR dele. Padrão: `console.error` |

`handler.hints(request)` devolve os valores de `Link` daquela requisição.

## Early Hints

O gateway lembra os remotes que cada caminho usou na última resposta e manda `Link` para eles na próxima. Na primeira visita, valem o remote da rota (`routes`) e os de `preload`.

Remote com [dedupe](../aprender/dedupe) leva no `Link` também a cópia própria das dependências (o React, por exemplo): na primeira visita é ela que a página usa.

| Remote | `Link` |
| --- | --- |
| Com hash (`integrity` ou `files`) | `rel=preload; as=fetch; crossorigin=anonymous` |
| Sem hash | `rel=modulepreload` |
| CSS | `rel=preload; as=style` (ou `as=fetch` com `isolate: 'shadow'`) |

Remote com hash não ganha `modulepreload`: o módulo entraria no mapa de módulos sem conferência do hash. O `preload` só aquece o cache HTTP.

Canal (`canal.json`) não ganha `Link` nem SSR: a versão é sorteada no cliente.

## Manifesto no HTML

Junto do HTML de cada remote renderizado, o gateway põe o manifesto que usou:

```html
<div data-vitral-ssr data-vitral-slot="carrinho">
  <script type="application/json" data-vitral-manifest="/_vitral/carrinho/vitral.json">{…}</script>
  …
</div>
```

No cliente, a hidratação usa esse manifesto em vez de buscar o `vitral.json`: uma ida e volta a menos, e o JS que hidrata é o da mesma versão que gerou o HTML. Vale só quando a URL do atributo é a mesma registrada no `configure` do host, e só para essa primeira carga. Depois, o loader busca o manifesto como sempre.

## Limites

- O manifesto passa pelo gateway sem cache (`no-cache` do loader continua valendo). Manifestos e CSS ficam em memória por `ttl` só para os hints e o SSR.
- `Content-Encoding` e `Content-Length` saem das respostas repassadas: o `fetch` já decodificou o corpo. A Cloudflare comprime de novo na borda; no Node, ponha compressão na frente se precisar.
- O rewriter próprio procura só `<vitral-remote>`, `<vitral-outlet>` e os filhos diretos deles. Ignora comentários e o conteúdo de `<script>`, `<style>`, `<textarea>` e `<title>`.
