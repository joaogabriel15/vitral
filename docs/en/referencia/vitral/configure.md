# configure

Registers the remotes and sets the host's options.

```ts
configure(config: VitralConfig): void
```

## Usage

```ts
import { configure } from 'vitral'

configure({
  remotes: { cart: 'https://cdn.example.com/cart/vitral.json' },
})
```

Call it before rendering the first remote.

## Parameters

| Option | Default | What it does |
| --- | --- | --- |
| `remotes` | none | Map of `name → URL` or `name → entry`, or the URL of a JSON file with that map |
| `allowedOrigins` | page and registered URLs | Allowed origins. `['*']` allows everything. See [SRI and origins](/en/aprender/seguranca) |
| `timeout` | `15000` | Maximum time for each download, in ms |
| `retries` | `1` | New attempts for the JS on a network error or `TIMEOUT` |
| `isolate` | `'none'` | `'shadow'`, `'iframe'` or `'reframe'` for every remote |
| `styles` | none | `{ inherit, mirrorTheme }`. See [Styles](/en/aprender/estilos) |
| `onMetric` | none | Receives `{ name, stage, start, duration }` for each stage. See [Loading](/en/aprender/carregamento#metrics) |
| `onError` | none | Receives each `RemoteError` from any remote, once. See [Errors](/en/aprender/erros#attribution-and-global-onerror) |
| `captureGlobalErrors` | `false` | Attributes to a remote the unhandled errors that come from its code |
| `devOverrides` | `false` | `true` accepts `?vitral=` outside `localhost`. `{ preview: 'https://{name}-{ref}.preview.example.com' }` does the same and resolves `?vitral=name@pr-123`. See [Development](/en/aprender/desenvolvimento#link-to-a-pr-preview) |
| `dedupe` | none | Dependencies the host offers to the remotes. See [Dedupe](/en/aprender/dedupe) |
| `contract` | none | Contract range accepted from the remotes, e.g. `'^2'`. See [Contract](/en/aprender/deploy#contract-between-host-and-remote) |
| `canaryKey` | random id in `localStorage` | User key used to draw who gets a channel's canary. See [Canary and rollback](/en/aprender/canary) |
| `onRollback` | none | Receives `{ name, from, to, errors, mounts }` when a channel's canary goes back to stable |

## Returns

Nothing.

## Remote entry

Each value in `remotes` is a URL or an object:

```ts
configure({
  remotes: {
    cart: 'https://cdn.example.com/cart/vitral.json',
    payment: {
      url: 'https://cdn.partner.com/payment/vitral.json',
      integrity: 'sha384-…',
      css: ['https://cdn.partner.com/payment/theme.css'],
      isolate: 'shadow',
    },
    menu: { module: () => import('./menu') },
  },
})
```

| Field | What it does |
| --- | --- |
| `url` | URL of `vitral.json`, of the JS or of a channel (`canal.json`) |
| `module` | Local remote, no network: the module or a function that imports it |
| `integrity` | JS hash. Wins over the one in `vitral.json` |
| `css` | Extra CSS |
| `isolate` | This remote's isolation |
| `manifest` | Embedded `vitral.json` |
| `contract` | Contract range accepted from this remote. Wins over the one in `configure` |
| `resolve` | With a channel: `(channel, { name, bucket }) => version`. See [Canary and rollback](/en/aprender/canary) |
| `rollback` | With a channel: `{ errors, mounts }` for the automatic rollback, or `false`. Default `{ errors: 3, mounts: 20 }` |

Isolation: the component's wins over the entry's, which wins over `configure`'s.

## Other bundlers

The host accepts the JS URL directly. Any bundler works, as long as it outputs an ES module with `mount` on `default`:

```ts
configure({
  remotes: {
    cart: { url: 'https://cdn.example.com/cart/remote.js', css: ['https://cdn.example.com/cart/remote.css'] },
  },
})
```

::: warning Warning
Without the plugin, the CSS isn't scoped. Use `isolate: 'shadow'`.
:::

## Notes

- It can be called more than once. The options add up.
- With `remotes` as a URL, the JSON is downloaded on the first mount.
