# Updates without reload

Swaps a mounted remote for the new version when a deploy goes out, without reloading the page.

## When to use it

In SPAs that stay open for hours.

## Code

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates() // checks the manifests on every navigation

events.on('vitral:update-available', ({ name }) => {
  refresh(name) // or show a notice and call it when the user wants
})
```

| Function | What it does |
| --- | --- |
| `watchUpdates()` | Checks the `vitral.json` of the mounted remotes on every navigation. Returns the function that turns it off |
| `checkUpdates()` | Checks now. Returns the names with a new version |
| `refresh(name)` | Downloads the new version and swaps every mount, with the current props |

- `vitral:update-available` fires once per deploy, with `{ name, entry }`.
- If the new version fails, the old one stays on screen.
- Only remotes registered by their `vitral.json` URL (or a [channel](./canary)) are checked.
