# Dicionários de compressão

A cada deploy, o nome do arquivo do remote muda (`remote-a1b2c3d4.js` vira `remote-e5f6g7h8.js`) e quem já tinha a versão anterior baixa tudo de novo. Com dicionários de compressão ([RFC 9842](https://www.rfc-editor.org/rfc/rfc9842)), o navegador usa a versão anterior, que já está em cache, como dicionário. Ele baixa só a diferença.

Funciona no Chrome e no Edge 130+. Os outros navegadores recebem o arquivo normal. Nada muda no host nem no remote: o navegador descomprime sozinho, e o SRI confere o arquivo já descomprimido.

## Quanto economiza

Nos remotes de exemplo, entre duas versões, o arquivo baixado ficou cerca de 90% menor que com brotli. Num deploy pequeno (uma linha mudada), cerca de 99% menor. O método está em `bench/dicionarios.mjs`.

## 1. Gerar os deltas no build

Guarde o `dist` do deploy anterior (ou baixe do CDN) e rode depois do build:

```bash
npx vite build
npx vitral dict dist --from ../dist-anterior
```

```
remote-CugL7DjS.js  br    12.8 kB  dcz     3.7 kB  dcb     3.5 kB  (de ../dist-anterior/remote-Cc6lePYW.js)
[vitral] 13 arquivos, 2 deltas. Índice: dist/vitral-dict.json
```

Para cada `.js` e `.css` com versão anterior, grava `<arquivo>.<hash>.dcz` e, se o binário `brotli` estiver no PATH, `<arquivo>.<hash>.dcb`. Grava também `dist/vitral-dict.json`, o índice que o servidor lê. Use `--from` mais de uma vez para cobrir usuários com versões mais antigas.

| Opção | O que faz |
| --- | --- |
| `--from pasta` | Dist de uma versão anterior. Obrigatória, pode repetir |
| `--level n` | Nível do zstd. Padrão: 19 |
| `--no-dcb` | Não gera `.dcb` mesmo com o binário `brotli` |

Precisa de Node 22.19+ ou 24.6+ (zstd com dicionário).

## 2. Servir com `vitral/dict`

O middleware faz duas coisas:

- toda resposta de `.js` e `.css` do índice sai com `Use-As-Dictionary` e `Vary`;
- quando o pedido traz `Available-Dictionary` com o hash de uma versão anterior, responde o `.dcz` ou `.dcb` com `Content-Encoding: dcz` ou `dcb`.

Só usa `Request` e `Response` da Web. Roda em Node, Deno, Bun e edges.

### Edge (Cloudflare Workers, Deno, Bun)

```ts
import { createDict } from 'vitral/dict'
import index from './dist/vitral-dict.json'

export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }) {
    const dict = createDict({
      index,
      base: '/chat/',
      read: (path) => env.ASSETS.fetch(`https://assets/chat/${path}`).then((r) => (r.ok ? r.body : null)),
    })
    const delta = await dict.fetch(request)
    if (delta) return delta
    const res = await env.ASSETS.fetch(request)
    const headers = dict.headers(new URL(request.url).pathname)
    if (!headers) return res
    const out = new Response(res.body, res)
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v)
    return out
  },
}
```

### Node (Express, Connect, `http`)

```ts
import express from 'express'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createDict } from 'vitral/dict'

const dist = 'dist'
const index = JSON.parse(await readFile(join(dist, 'vitral-dict.json'), 'utf8'))
const dict = createDict({ index, base: '/chat/', read: (p) => readFile(join(dist, p)).catch(() => null) })

const app = express()
app.use('/chat', (req, res, next) => dict.node({ method: req.method, url: req.originalUrl, headers: req.headers }, res, next))
app.use('/chat', express.static(dist, { immutable: true, maxAge: '1y' }))
```

### Opções de `createDict`

| Opção | O que faz |
| --- | --- |
| `index` | Conteúdo do `vitral-dict.json` |
| `read(path)` | Lê um arquivo do dist (caminho relativo). `null` se não existir |
| `base` | Caminho em que o dist é servido. Padrão: `/` |
| `cacheControl` | `Cache-Control` das respostas com delta. Padrão: um ano, `immutable` |

| Método | O que faz |
| --- | --- |
| `fetch(request)` | `Response` com o delta, ou `undefined` para servir o arquivo normal |
| `headers(pathname)` | Cabeçalhos para a resposta normal, ou `undefined` fora do índice |
| `node(req, res, next)` | O mesmo para Node: responde o delta ou põe os cabeçalhos e chama `next` |

## Regras do navegador

- Só em HTTPS ou `localhost`.
- O dicionário e o arquivo novo precisam ser da mesma origem. Remote em outra origem que o host precisa de CORS (`Access-Control-Allow-Origin`), como já precisa para carregar.
- `Cache-Control: no-store` desliga o dicionário. Use o cache longo dos arquivos com hash ([Deploy](./deploy)).
- O CDN na frente precisa respeitar `Vary: Accept-Encoding, Available-Dictionary`, ou desligue o cache dele para esses arquivos.
