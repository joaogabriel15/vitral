# Compression dictionaries

On every deploy, the remote's file name changes (`remote-a1b2c3d4.js` becomes `remote-e5f6g7h8.js`) and whoever had the previous version downloads everything again. With compression dictionaries ([RFC 9842](https://www.rfc-editor.org/rfc/rfc9842)), the browser uses the previous version, already in cache, as a dictionary. It downloads only the difference.

It works in Chrome and Edge 130+. Other browsers get the normal file. Nothing changes in the host or the remote: the browser decompresses on its own, and SRI checks the decompressed file.

## How much it saves

In the example remotes, between two versions, the downloaded file was about 90% smaller than with brotli. On a small deploy (one changed line), about 99% smaller. The method is in `bench/dicionarios.mjs`.

## 1. Generate the deltas at build time

Keep the previous deploy's `dist` (or download it from the CDN) and run after the build:

```bash
npx vite build
npx vitral dict dist --from ../dist-previous
```

```
remote-CugL7DjS.js  br    12.8 kB  dcz     3.7 kB  dcb     3.5 kB  (de ../dist-previous/remote-Cc6lePYW.js)
[vitral] 13 arquivos, 2 deltas. Índice: dist/vitral-dict.json
```

For each `.js` and `.css` with a previous version, it writes `<file>.<hash>.dcz` and, if the `brotli` binary is in the PATH, `<file>.<hash>.dcb`. It also writes `dist/vitral-dict.json`, the index the server reads. Use `--from` more than once to cover users on older versions.

| Option | What it does |
| --- | --- |
| `--from folder` | Dist of a previous version. Required, can repeat |
| `--level n` | zstd level. Default: 19 |
| `--no-dcb` | Doesn't generate `.dcb` even with the `brotli` binary |

Needs Node 22.19+ or 24.6+ (zstd with dictionary).

## 2. Serve with `vitral/dict`

The middleware does two things:

- every `.js` and `.css` response in the index goes out with `Use-As-Dictionary` and `Vary`;
- when the request brings `Available-Dictionary` with the hash of a previous version, it answers with the `.dcz` or `.dcb` and `Content-Encoding: dcz` or `dcb`.

It only uses Web `Request` and `Response`. It runs on Node, Deno, Bun and edges.

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

### `createDict` options

| Option | What it does |
| --- | --- |
| `index` | Contents of `vitral-dict.json` |
| `read(path)` | Reads a file from dist (relative path). `null` if it doesn't exist |
| `base` | Path where dist is served. Default: `/` |
| `cacheControl` | `Cache-Control` of the delta responses. Default: one year, `immutable` |

| Method | What it does |
| --- | --- |
| `fetch(request)` | `Response` with the delta, or `undefined` to serve the normal file |
| `headers(pathname)` | Headers for the normal response, or `undefined` outside the index |
| `node(req, res, next)` | The same for Node: answers with the delta or sets the headers and calls `next` |

## Browser rules

- Only on HTTPS or `localhost`.
- The dictionary and the new file must be on the same origin. A remote on another origin than the host needs CORS (`Access-Control-Allow-Origin`), as it already does to load.
- `Cache-Control: no-store` turns the dictionary off. Use the long cache for hashed files ([Deploy](./deploy)).
- The CDN in front must respect `Vary: Accept-Encoding, Available-Dictionary`, or turn its cache off for these files.
