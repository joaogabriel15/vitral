# TIMEOUT

The remote didn't finish downloading or loading within the time limit (default: 15000 ms). Applies to the manifest, the JS and `remotes.json`.

## Causes

- A slow or down CDN.
- A file too big for the user's connection.
- A top-level `import` in the remote that never finishes.

## How to fix

Check the URL in the browser's Network tab. If the time is normal for your case, raise the limit:

```ts
configure({ timeout: 30000 })
```

`TIMEOUT` errors are retried `retries` times (default: 1), waiting 200 ms, 400 ms, 800 ms…
