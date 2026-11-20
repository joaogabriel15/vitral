<script setup>
import { withBase } from 'vitepress'
</script>

# SRI and allowed origins

Before running a remote's JS, the library checks the origin. If the remote has a hash (`integrity`), it also checks the bytes. The origin check is on by default; the hash check depends on a hash being there.

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/seguranca-en.png')" alt="The host sets allowedOrigins and integrity. Before running, the library checks the origin and the SHA-384. If either fails, nothing runs and the error shows in place of the remote.">
  <img class="so-escuro" :src="withBase('/marca/seguranca-escuro-en.png')" alt="">
</picture>

## When to use it

Always. Adjust `allowedOrigins` when remotes come from more than one CDN. Pin `integrity` in the host for third-party remotes.

## Allowed origins

```ts
configure({
  allowedOrigins: ['https://cdn.example.com', 'https://static.partner.com'],
})
```

Without `allowedOrigins`, the page's origin and the origins of the URLs in `configure({ remotes })` are allowed. A `vitral.json` can't point the JS to another origin. A URL outside the list throws [`ORIGIN_BLOCKED`](/en/erros/ORIGIN_BLOCKED). `['*']` allows everything: use it only in development.

### Origins added to the list automatically

Some URLs join the list, with or without `allowedOrigins`, because they are written by whoever develops the host. The ones that can come from data never allow their own origin:

| Where the URL comes from | Joins the list? |
| --- | --- |
| `src` in `<Remote>`, `createSlot` and the framework components | Yes |
| `registerSrc(url)` (the third argument, `trusted`, is `true` by default) | Yes |
| `registerSrc(url, name, false)` | No |
| `src` in `<vitral-remote>` (HTML attribute) | No. Allow it with `data-origins` on the `auto.js` script or with `allowedOrigins`. On `localhost`, yes |
| Development override (`?vitral=` or the devtools panel) | Yes, only on `localhost` or with `devOverrides`. With `{ preview }`, only `localhost` and URLs from the template |

Never pass to `src` a URL that comes from data (API, query string, CMS). For that, use `registerSrc(url, name, false)` or `<vitral-remote src>`: the URL only loads if its origin is in `allowedOrigins` or was already registered by the host (`configure({ remotes })`). This way, a `<vitral-remote src>` injected into the HTML does not run code from another origin.

## Integrity (SRI)

The `vitral/vite` plugin writes the `sha384` hash of the JS and CSS into `vitral.json`. If the downloaded file doesn't match, the remote doesn't run and the error is [`INTEGRITY`](/en/erros/INTEGRITY).

The check only happens when a hash exists. Without `integrity` in the host and without a hash in `vitral.json` (a hand-written manifest, or a remote registered straight by its JS URL), the JS is imported unchecked.

The hash in `vitral.json` protects against a corrupted file or one swapped on the way, but not against a compromised CDN: whoever swaps the JS can swap the manifest too. For that, pin the hash in the host:

```ts
configure({
  remotes: {
    payment: { url: 'https://cdn.partner.com/payment/vitral.json', integrity: 'sha384-…' },
  },
})
```

Or embed the whole manifest with `{ url, manifest }`, or pin the remote's key (below).

| Option | Where | What it does |
| --- | --- | --- |
| `allowedOrigins` | `configure` | Origins code may be loaded from |
| `integrity` | remote entry | JS hash. Wins over the one in `vitral.json` |
| `manifest` | remote entry | `vitral.json` embedded in the host |
| `keys` | remote entry | The remote's Ed25519 public keys. See [Signatures](#signatures) |

Accepts `sha256`, `sha384` and `sha512`.

### How the browser checks

The library uses the best path the browser has: an import map with `integrity` (Chrome 133+, Safari 18.4+), `<link rel="modulepreload" integrity>` (Firefox) or, in the others, it downloads the file, checks the bytes and runs exactly what it checked. In all of them, the remote's chunks and `import()` are checked too. On the first visit, Chrome may show a `Failed to find a valid digest` line in the console: it is the library's test to find out whether the browser checks the hash, not an error in your remote.

## Signatures

Pinning the hash in the host forces a host change on every remote deploy. With signatures, the host pins the remote's public key, and the remote keeps publishing on its own. Whoever swaps the JS and `vitral.json` on the CDN without the private key can't make the file run.

In the remote, create the key pair once and keep the private key as a CI secret:

```bash
npx vitral sign --keygen
```

In CI, after the build (and after `vitral dict`, if you use it):

```bash
VITRAL_SIGNING_KEY="$(cat key.pem)" npx vitral sign dist --base /cart/
```

For `vitral.json`, each `.js` and each `.css`, the command writes the `Unencoded-Digest`, `Signature-Input` and `Signature` headers, in two formats:

- `dist/_headers`, which Netlify and Cloudflare Pages already read. If the file exists, the rest of it stays as it was.
- `dist/vitral-signatures.json`, public path → headers, for another server:

```ts
import signatures from './dist/vitral-signatures.json' with { type: 'json' }
app.use((req, res, next) => {
  const h = signatures[req.path]
  if (h) res.set(h)
  next()
})
```

`--base` is the folder's public path on the server (default: `/`). The signature covers the hash of the uncompressed content: gzip, brotli and the `vitral dict` dictionaries don't invalidate it. Any change to the file after `vitral sign` does.

In the host:

```ts
configure({
  remotes: {
    cart: { url: 'https://cdn.example.com/cart/vitral.json', keys: ['<public key from vitral sign --keygen>'] },
  },
})
```

In Next, the same `keys` goes in the remote's entry in `withVitral`; `remoteProps` from `vitral/next-server` also checks the manifest's signature on the server and, if it doesn't match, returns `null`.

Chrome 141+ only runs the file if the hash matches and the signature is from one of the keys. Other browsers check only the hash. To rotate keys without stopping the remote, put both in `keys`, sign with the new one and then remove the old one.

## CSP

Include the remotes' origin in `script-src` and `connect-src`, and `blob:` in `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.example.com blob:; connect-src 'self' https://cdn.example.com
```

If the page has a `<script nonce>`, the library uses the same `nonce` on the SRI import map. Without a `nonce`, the CSP blocks that map and the library uses the other paths.

With `script-src 'self'` and the remote on the same origin, SRI also works without `blob:`. In that case, on the first visit the console also shows the CSP lines refusing the test's two `blob:` modules; the library moves on to the remote's test modules (`split/vitral-probe*.js`). After a network failure, the retry downloads the file again from a new URL (`?vitral-retry=1`), with the hash checked by the browser.

## Development overrides

`?vitral=name@http://localhost:5174` swaps a remote's URL and drops the host's `integrity`. It only works with the page on `localhost` or with `configure({ devOverrides })`. Don't turn `devOverrides` on in production: with `true`, any link with `?vitral=` would run code from another origin. In the `{ preview }` form, only aliases, `localhost` and URLs from the template are accepted, but a link still swaps the remote for a PR preview.

## SBOM

With `sbom: true`, the plugin writes `sbom.cdx.json` next to `vitral.json`: a [CycloneDX 1.6](https://cyclonedx.org/docs/1.6/json/) SBOM with the npm packages that went into the remote's bundle.

```js
// remote's vite.config.js
plugins: [react(), vitral({ sbom: true })]
```

The EU Cyber Resilience Act (CRA) requires makers of products with software sold in the EU to keep an SBOM for them starting December 11, 2027. Each remote is published on its own, so each has its own.

The SBOM lists the packages that actually went into the bundle, with version, license and who imports whom. `vitral.json` points to it with its hash. For a reproducible build, set `SOURCE_DATE_EPOCH`.

## What is not isolated

The remote runs with the page's privileges. Shadow DOM isolates CSS, not JS. For code you don't trust, use an [iframe](./iframe).
