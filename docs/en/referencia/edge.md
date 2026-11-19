# vitral/edge

A gateway that serves the host and the remotes from a single origin. Runs on the edge (Cloudflare Workers) and in Node, Deno and Bun.

```ts
gateway(options: GatewayOptions): Gateway   // (request: Request) => Promise<Response>
toNodeListener(handler): (req, res) => void  // for http.createServer
```

What it does:

- `/_vitral/<name>/<path>` goes to the remote's folder on the CDN. `vitral.json` comes out with the CDN's absolute URLs replaced by paths on this origin. SRI hashes don't change: the bytes are the same.
- Everything else goes to `origin`, the host app.
- In the HTML, `<vitral-remote src="https://cdn…/vitral.json">` now points to `/_vitral/…`.
- The HTML response gets a `Link` header with the files of the page's remotes (Early Hints).
- A remote with `render` comes out rendered in the HTML, in Declarative Shadow DOM. See [SSR](../aprender/ssr#remote-ssr-through-the-gateway).
- With `routes`, `<vitral-outlet>` receives the remote for the URL's route, already rendered, and the response already carries its `Link` on the first visit. See [Routes with SSR](../aprender/ssr#routes-with-ssr).

It uses only Web APIs and no dependencies. Where `HTMLRewriter` exists (Cloudflare Workers), it uses it. In other runtimes, it uses its own streaming rewriter.

## Cloudflare Workers

```ts
// worker.ts
import { gateway } from 'vitral/edge'
import { render as cart } from 'cart/server'

const handler = gateway({
  origin: 'https://app.example.com',
  remotes: {
    cart: { url: 'https://cdn.example.com/cart/vitral.json', render: cart },
    search: 'https://cdn.example.com/search/vitral.json',
  },
  isolate: 'shadow',
})

export default { fetch: handler }
```

Turn on **Early Hints** in the zone: Cloudflare keeps the responses' `Link` headers and sends `103` on the next visits.

## Node

```ts
// gateway.mjs
import { createServer } from 'node:http'
import { gateway, toNodeListener } from 'vitral/edge'

const handler = gateway({
  origin: 'http://localhost:3000',
  remotes: { cart: 'https://cdn.example.com/cart/vitral.json' },
})

createServer(toNodeListener(handler)).listen(8080)
```

`toNodeListener` sends `103 Early Hints` (`res.writeEarlyHints`) before fetching the page.

Deno and Bun take the handler directly:

```ts
Deno.serve(handler)
Bun.serve({ fetch: handler })
```

## In the host

Register the remotes by the gateway path:

```ts
configure({ remotes: { cart: '/_vitral/cart/vitral.json' } })
```

With `<vitral-remote src="https://cdn…">` in the HTML, the gateway already replaces the `src`.

## Options

| Option | What it does |
| --- | --- |
| `origin` | The host's origin. Required |
| `remotes` | `{ name: url }` or `{ name: { url, render?, isolate? } }`. `url` is the `vitral.json` (or the JS) on the CDN |
| `prefix` | Prefix of the remotes' paths. Default `/_vitral/` |
| `isolate` | SSR isolation when the tag has no `isolate` (the same as the host's `configure`). Default `'none'` |
| `preload(url)` | Names of the remotes for this URL, to send `Link` on the first visit |
| `routes` | The same map as the client's [`routes()`](./routes). The route's remote comes out rendered in `<vitral-outlet>` and goes into `Link` on the first visit |
| `fetch` | `fetch` used to talk to the host and the CDNs |
| `ttl` | How long manifests and CSS stay in memory, in ms. Default `60000` |
| `onError(error, name)` | Error in a remote's SSR. The page goes out without its SSR. Default: `console.error` |

`handler.hints(request)` returns the `Link` values for that request.

## Early Hints

The gateway remembers the remotes each path used in the last response and sends `Link` for them on the next one. On the first visit, the route's remote (`routes`) and those from `preload` apply.

A remote with [dedupe](../aprender/dedupe) also puts its own copy of the dependencies (React, for example) in `Link`: on the first visit, that's the one the page uses.

| Remote | `Link` |
| --- | --- |
| With a hash (`integrity` or `files`) | `rel=preload; as=fetch; crossorigin=anonymous` |
| Without a hash | `rel=modulepreload` |
| CSS | `rel=preload; as=style` (or `as=fetch` with `isolate: 'shadow'`) |

A remote with a hash doesn't get `modulepreload`: the module would enter the module map without the hash being checked. `preload` only warms the HTTP cache.

A channel (`canal.json`) gets neither `Link` nor SSR: the version is drawn on the client.

## Manifest in the HTML

Next to the HTML of each rendered remote, the gateway puts the manifest it used:

```html
<div data-vitral-ssr data-vitral-slot="cart">
  <script type="application/json" data-vitral-manifest="/_vitral/cart/vitral.json">{…}</script>
  …
</div>
```

On the client, hydration uses this manifest instead of fetching `vitral.json`: one round trip less, and the JS that hydrates is from the same version that generated the HTML. It applies only when the attribute's URL is the same one registered in the host's `configure`, and only for that first load. After that, the loader fetches the manifest as usual.

## Limits

- The manifest goes through the gateway without cache (the loader's `no-cache` still applies). Manifests and CSS stay in memory for `ttl` only for the hints and SSR.
- `Content-Encoding` and `Content-Length` are dropped from forwarded responses: `fetch` already decoded the body. Cloudflare compresses again at the edge; in Node, put compression in front if you need it.
- The built-in rewriter only looks for `<vitral-remote>`, `<vitral-outlet>` and their direct children. It ignores comments and the content of `<script>`, `<style>`, `<textarea>` and `<title>`.
