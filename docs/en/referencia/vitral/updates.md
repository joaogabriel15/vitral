# watchUpdates

Swaps a mounted remote for the new version when a deploy goes out.

```ts
watchUpdates(): () => void
checkUpdates(): Promise<string[]>
refresh(name: string): Promise<void>
```

## Usage

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates()

events.on('vitral:update-available', ({ name }) => refresh(name))
```

## Functions

| Function | What it does | Returns |
| --- | --- | --- |
| `watchUpdates()` | Checks the `vitral.json` of the mounted remotes on every navigation | Function that turns it off |
| `checkUpdates()` | Checks now | Names with a new version |
| `refresh(name)` | Downloads the new version and swaps every mount, with the current props | Promise |

## Notes

- `vitral:update-available` fires once per deploy, with `{ name, entry }`.
- `await refresh(name)` resolves when every mount already shows the new version.
- If the new version doesn't load or its `mount` fails, the old one stays on screen and `refresh` rejects with the `RemoteError`.
- Two `refresh` calls in a row for the same remote: the last one's version stays, even if the first finishes later.
- Only remotes registered by their `vitral.json` URL are checked.
