# Deploy

Each remote has its own deploy. The host sees the new version with no new build.

## Publish the remote

```bash
npx vite build
```

Upload the `dist` folder to a CDN. The host must be able to download the files from another origin: enable CORS.

```
Access-Control-Allow-Origin: https://www.example.com
```

## CDN cache

| File | `Cache-Control` |
| --- | --- |
| `vitral.json` | `no-cache` |
| `remote-*.js`, `remote-*.css` | `public, max-age=31536000, immutable` |

`vitral.json` changes on every deploy. The other files have a hash in the name and never change.

## Origins and hash

The host only runs JS from allowed origins and checks the hash of each file:

```ts
configure({
  allowedOrigins: ['https://cdn.example.com'],
  remotes: { cart: 'https://cdn.example.com/cart/vitral.json' },
})
```

Details in [SRI and origins](./seguranca).

## CSP

Include the remotes' origin in `script-src` and `connect-src`, and `blob:` in `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.example.com blob:; connect-src 'self' https://cdn.example.com
```

## Service worker

`remoteWorker` from `vitral/sw` is a ready-made service worker for the remotes:

```js
// host's sw.js
import { remoteWorker } from 'vitral/sw'

remoteWorker(self, { manifests: ['/account/vitral.json'] })
```

It stores each remote's files in the cache on install, and on the next visit the remote opens with no network. `vitral.json` always goes to the network first, so a new deploy arrives on the next load, and the previous version's files leave the cache.

It stores what the page uses: the split build, the CSS and the routes. The single file is left out, because it only serves old browsers and the retry after a failure.

| Option | Default | What it does |
| --- | --- | --- |
| `cache` | `'vitral-remotes'` | Cache name |
| `offered` | none | Version of each `dedupe` group the host offers, like `{ react: '19.2.0' }`. The remote's own copy for those groups is left out |
| `single` | `false` | Also stores the single file |

To build your own worker, `remoteFiles(url, options)` lists the same files, and `filesOf(manifest, url, options)` does the same for a manifest already read:

```js
import { remoteFiles } from 'vitral/sw'

self.addEventListener('install', (e) => e.waitUntil(
  remoteFiles('/account/vitral.json').then((urls) => caches.open('remotes').then((c) => c.addAll(urls))),
))
```

## New version without reloading

For SPAs that stay open for hours:

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates()
events.on('vitral:update-available', ({ name }) => refresh(name))
```

See [Updates without reload](./atualizacoes).

## Tab open during a deploy

A tab opened before the deploy still points to the previous version's files. If the CDN already deleted them, the next route that downloads a chunk fails.

Today (Module Federation, Multi-Zones), the host reloads the page when the error shows up:

```js
// shell/src/main.js
window.addEventListener('vite:preloadError', () => location.reload())
```

With vitral, no code is needed:

- If the remote's JS doesn't load, the host reads `vitral.json` again, without cache, and tries the new version.
- If a chunk of a mounted remote is gone, the host swaps the mount for the new version, with the current props, once per remote.
- If the missing version was a canary, the host goes back to stable.

Even so, keep the files of the last versions on the CDN for a few days. Names have hashes, so they don't mix.

## Contract between host and remote

Remote and host have separate deploys. A remote deploy can break the host, for example when it changes the props or events it uses. The contract makes the host refuse an incompatible remote instead of mounting it.

In the remote, declare the contract version. Bump the first number when the change breaks the host:

```js
// remote's vite.config.js
vitral({ contract: { version: '2.1.0' } })
```

`vitral.json` then has:

```json
"contract": { "version": "2.1.0", "peers": { "react": "^19.0.0" } }
```

`peers` is filled in automatically with `dedupe`.

In the host, declare the accepted range, for every remote or for one:

```ts
configure({
  contract: '^2',
  remotes: {
    cart: 'https://cdn.example.com/cart/vitral.json',
    search: { url: 'https://cdn.example.com/search/vitral.json', contract: '^1' },
  },
})
```

Before running the remote, the host checks the contract version and the `peers` dependencies. If something doesn't fit, the remote doesn't mount and the error is [`CONTRACT_MISMATCH`](/en/erros/CONTRACT_MISMATCH). The component's `fallback` and `error` show as for any other error.

Without `contract` on one of the sides, nothing is checked: old manifests keep working. Use `contract: '*'` in the host to check only the dependencies.

## Roll back a version

Publish the previous version of `vitral.json`. The host downloads the old JS on the next load.

To avoid republishing, use a channel: each version stays in its own folder and a `channel.json` says which one is live. The channel also releases the new version to a share of users and goes back to the stable one by itself when the new one errors. See [Canary and rollback](./canary).

For a widget other companies paste on their site, with a single `<script>` tag, see [Widget on third-party sites](./terceiros).
