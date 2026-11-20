# Widget on third-party sites

A widget (chat, checkout, reviews) that other companies put on their site, with no bundler and nothing to install. The site pastes one tag:

```html
<div id="chat"></div>
<script
  src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js"
  data-remote="https://cdn.example.com/chat/canal.json"
  data-target="#chat"
  data-props='{"lang":"en"}'
  async
></script>
```

`embed.js` is a single file, with no chunks, that runs as a classic `<script>` (with `async` or `defer`). It mounts a [`<vitral-remote>`](/en/referencia/element) inside `data-target`.

## Attributes

| Attribute | What it does |
| --- | --- |
| `data-remote` | URL of the widget's channel (`canal.json`) or of a `vitral.json`. Required |
| `data-target` | Selector of the element the widget goes into. Without it, it goes right after the script (at the end of `<body>`, if the script is in `<head>`) |
| `data-props` | Props as JSON |
| `data-isolate` | `shadow` (default) or `none` |
| `data-loading` | `lazy` or `idle` |
| `data-name` | Remote name, instead of the URL |
| `data-origins` | Extra origins for the JS and CSS, separated by spaces, when they aren't the manifest's |

With `async`, the script can run before `data-target` exists. In that case the loader waits for the HTML to finish loading.

## Shadow DOM by default

The widget's CSS stays inside a shadow root: a `p { color: green }` in the widget doesn't paint the site's paragraphs, and the site's CSS doesn't break the widget.

Inherited properties (`font-family`, `color`, `line-height`) cross the Shadow DOM. Set them on the widget's root element if it needs a fixed look.

`data-isolate="none"` mounts without Shadow DOM, with the CSS in the site's `<head>`. Use it only if the widget's CSS is scoped on its own.

## Allowed origins

The loader only allows the origin of `data-remote` (and those in `data-origins`). A `<vitral-remote src>` with another origin, injected into the site through user HTML (a comment, a profile field), fails with [`ORIGIN_BLOCKED`](/en/erros/ORIGIN_BLOCKED) and runs nothing.

If the manifest points the JS or CSS to another origin, declare it:

```html
<script src="…/embed.js" data-remote="https://api.example.com/chat/canal.json"
  data-origins="https://static.example.com" async></script>
```

## Talking to the widget

The site can change the props and listen to the element's events:

```js
const chat = document.querySelector('#chat vitral-remote')
chat.addEventListener('vitral-ready', () => console.log('chat ready'))
chat.addEventListener('vitral-error', (e) => console.log(e.detail.error.code))
chat.props = { lang: 'pt' }
```

Several tags on the same page work. The first copy of `embed.js` that runs serves the others.

## Versions and channel

Each widget version lives in a folder that never changes. The channel (`canal.json`) says which version the sites get. It is the same channel as in [Canary and rollback](./canary): `embed.js` already ships the code that reads it.

```
https://cdn.example.com/chat/
  canal.json                       { "stable": "1.4.2" }
  1.4.2/vitral.json, remote-[hash].js, remote.css
  1.5.0/vitral.json, …
```

Sites point `data-remote` to `canal.json` and never change the tag again. Those who need a fixed version point to its folder (`/chat/1.4.2/vitral.json`).

Publish a version without changing what the sites get:

```js
// widget's vite.config.js
vitral({ versionDir: true }) // build into dist/<version>/
```

```bash
npx vite build
aws s3 sync dist s3://cdn-company/chat/ --cache-control "public, max-age=31536000, immutable"
```

Then edit the channel with `vitral canal` and publish only it:

```bash
npx vitral canal canal.json --stable 1.4.2                  # creates the channel
npx vitral canal canal.json --canary 1.5.0 --percent 10     # 10% of visitors get 1.5.0
npx vitral canal canal.json --percent 50                    # 50%
npx vitral canal canal.json --stable 1.5.0 --canary off     # promotes 1.5.0
npx vitral canal canal.json --stable 1.4.2                  # goes back to 1.4.2

aws s3 cp canal.json s3://cdn-company/chat/canal.json --cache-control "no-cache"
```

Rolling back is editing the channel: the next page load on each site already uses the channel's version, with no build and no change to the tag.

Who gets the canary is drawn from an id stored in the site's `localStorage`, so a visitor doesn't switch versions on every load. If the canary errors, that browser goes back to stable by itself. Details in [Canary and rollback](./canary).

## Cache

| Path | `Cache-Control` |
| --- | --- |
| `embed.js` with the version in the URL (`vitral@0.4.0`) | `public, max-age=31536000, immutable` (jsDelivr already sends it) |
| `/chat/<version>/*`, including `vitral.json` | `public, max-age=31536000, immutable` |
| `/chat/canal.json` | `no-cache` |

The loader always revalidates the channel (with `ETag`, the response is a small `304`). That's why a channel edit reaches every site on the next page load. To spare the origin, the CDN can keep the channel for a short time (`s-maxage=60`): the edit then takes up to a minute to arrive.

The widget's CDN must allow CORS for any site:

```
Access-Control-Allow-Origin: *
```

Don't use `embed.js` without a version in the URL (`vitral/dist/embed.js`): a new library version would change the widget on every site without notice.

## CSP

Give the site one of these two recipes. Both were tested with `embed.js`.

### With a nonce (recommended)

The site already generates a `nonce` per response and puts it on the tag:

```
Content-Security-Policy:
  script-src 'nonce-{nonce}' 'strict-dynamic';
  connect-src 'self' https://cdn.example.com;
  style-src 'self' https://cdn.example.com
```

```html
<script nonce="{nonce}" src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js" data-remote="…" async></script>
```

With `'strict-dynamic'`, the JS that `embed.js` imports inherits the tag's trust. The library uses the same `nonce` on the import map that checks each module's hash.

### With the list of origins

```
Content-Security-Policy:
  script-src 'self' https://cdn.jsdelivr.net https://cdn.example.com blob:;
  connect-src 'self' https://cdn.example.com;
  style-src 'self' https://cdn.example.com
```

Without a nonce, the CSP refuses the tests the library runs in the browser (an import map and two `data:` modules). The widget mounts anyway: the hash is checked on the bytes, which run through `blob:`. The refusals show in the console and in the site's `report-uri`, if there is one.

### What each directive allows

| Directive | For what |
| --- | --- |
| `script-src` | `embed.js` and the widget's JS. `blob:` only in the recipe without a nonce |
| `connect-src` | The channel, `vitral.json` and the widget's CSS (in Shadow DOM, the CSS is downloaded with `fetch`) |
| `style-src` | The widget's `@font-face` and `@property`, which go into a `<link>` in the document |

## Pin the loader's hash

The versioned URL never changes, so the site can pin the hash of `embed.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js"
  integrity="sha384-…" crossorigin="anonymous" data-remote="…" async></script>
```

```bash
curl -s https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js | openssl dgst -sha384 -binary | openssl base64 -A
```

The hash of the widget's JS comes in `vitral.json` (see [SRI and origins](./seguranca)).

## Size

`embed.js` is about 11 kB with brotli: `<vitral-remote>`, Shadow DOM, hash checking and the channel in one file. It is the same code a site with a bundler would download with `vitral/auto`, but in a single request.

## Without a script tag

On a site that already loads modules, `vitral/auto` registers `<vitral-remote>` directly:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/auto.js" data-origins="https://cdn.example.com"></script>
<vitral-remote src="https://cdn.example.com/chat/canal.json" isolate="shadow"></vitral-remote>
```

In that case, the site sets `allowedOrigins` if needed (see [SRI and origins](./seguranca)).
