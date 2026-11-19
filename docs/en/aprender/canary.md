# Canary and rollback

Publishes a remote's new version to a share of users and goes back to the previous one with no host build and no external service. Everything lives in static files on your CDN.

## How it works

- Each version is published in its own folder and never changes afterwards.
- A pointer file, the channel (`canal.json`), says which version is stable and which is the canary.
- The host downloads the channel, picks the user's version and follows its `vitral.json`.
- Rolling back is editing the channel.

```
https://cdn.example.com/checkout/
  canal.json
  1.4.0/vitral.json, remote-[hash].js, ...
  1.5.0/vitral.json, remote-[hash].js, ...
```

## 1. Publish each version in its own folder

In the remote, turn on `versionDir`. The build goes to `dist/<version>/`, with the `version` from `package.json`:

```js
// remote's vite.config.js
vitral({ versionDir: true })
```

Upload `dist/` to the CDN without deleting the previous versions' folders. The files in a version folder can have an eternal cache, including its `vitral.json`.

## 2. Write the channel

```json
{ "stable": "1.4.0", "canary": { "version": "1.5.0", "percent": 10 } }
```

| Field | What it does |
| --- | --- |
| `stable` | Version for whoever isn't in the canary |
| `canary.version` | New version |
| `canary.percent` | Share of users that gets the canary, from 0 to 100 |

A version like `"1.5.0"` becomes `1.5.0/vitral.json`, next to the channel. A path (`"./beta/vitral.json"`) or a full `vitral.json` URL works too.

The channel changes on every release: serve it with `Cache-Control: no-cache`, like the usual `vitral.json`.

The [CLI](/en/referencia/cli#vitral-canal) creates and edits the channel without opening the JSON:

```bash
npx vitral canal canal.json --stable 1.4.0
npx vitral canal canal.json --canary 1.5.0 --percent 10
```

## 3. Point the host to the channel

Register the channel URL instead of the `vitral.json` URL:

```ts
configure({
  remotes: { checkout: 'https://cdn.example.com/checkout/canal.json' },
})
```

The host recognizes the channel by its `stable` field. Nothing else changes: `fallback`, contract, SRI and `onError` work as before, with the chosen version's `vitral.json`.

## Who gets the canary

Each user has a number from 0 to 99 per remote, the `bucket`. Whoever has `bucket < percent` gets the canary. The number is always the same for the same user, so they don't switch versions on every load. Raising `percent` from 10 to 50 keeps in the canary whoever was already there.

By default, the number comes from a random id stored in the browser's `localStorage`. For the same user to get the same version on every device, pass a key of theirs:

```ts
configure({ canaryKey: user.id })
```

## Your own rule: cookie, test group, query

`resolve` picks the version. It receives the channel and `{ name, bucket }`, and returns the version (or the URL of a `vitral.json`). Returning `undefined` uses the default rule.

```ts
configure({
  remotes: {
    checkout: {
      url: 'https://cdn.example.com/checkout/canal.json',
      // Whoever has the beta=1 cookie gets the canary; the others follow percent.
      resolve: (channel) => (document.cookie.includes('beta=1') ? channel.canary?.version : undefined),
    },
  },
})
```

The channel accepts fields of your own, which `resolve` reads:

```json
{ "stable": "1.4.0", "internal": "1.6.0-rc.1" }
```

```ts
resolve: (channel) => (user.employee ? (channel.internal as string) : undefined)
```

## Automatic rollback

When the chosen version isn't the stable one, the host counts its errors: download failure, `CONTRACT_MISMATCH`, `mount` error, `ctx.reportError` and, with `captureGlobalErrors`, unhandled errors attributed to the remote. They are the same errors that reach the `configure` `onError`.

With 3 errors in a window of 20 mounts, the host:

1. goes back to stable until the end of the tab's session (stored in `sessionStorage`);
2. swaps the mounts on screen for the stable one, with the current props;
3. calls `onRollback`.

```ts
configure({
  remotes: {
    checkout: { url: 'https://cdn.example.com/checkout/canal.json', rollback: { errors: 3, mounts: 20 } },
  },
  onRollback: ({ name, from, to, errors, mounts }) => {
    analytics.track('rollback', { name, from, to, errors, mounts })
  },
})
```

| `rollback` field | Default | What it does |
| --- | --- | --- |
| `errors` | `3` | Errors that trigger the rollback |
| `mounts` | `20` | Window size, in mounts. The error count restarts on each window |

`rollback: false` turns it off. The rollback only applies to that browser. To take the canary away from everyone, edit the channel.

If the channel publishes another canary (e.g. `1.5.1`), it is tried again, even in the session that dropped `1.5.0`.

## Roll back a version for everyone

Edit the channel:

```json
{ "stable": "1.4.0" }
```

Or: `npx vitral canal canal.json --stable 1.4.0 --canary off`.

The next load of each page already uses `1.4.0`. Open pages see the change with [`watchUpdates()`](./atualizacoes), because the channel is checked like a `vitral.json`.

To promote the canary, set `stable` to `"1.5.0"` and remove `canary`.

## Notes

- The host entry's `integrity` and embedded `manifest` don't apply to channels: integrity comes from each version's `vitral.json`.
- The channel and the versions go through the same [origins](./seguranca) rule. Versions on an origin other than the channel's must be in `allowedOrigins`.
