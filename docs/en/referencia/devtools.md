# vitral/devtools

Panel to swap a remote's URL during development.

```ts
devtools(options?: { reload?: boolean }): () => void
getOverrides(): Record<string, string>
setOverride(name: string, url: string | null): void
activeOverrides(): ActiveOverride[]
clearOverrides(): void

interface ActiveOverride {
  name: string
  value: string                  // as requested: URL or alias (pr-123)
  url?: string                   // manifest URL; empty if the alias has no template
  source: 'aba' | 'navegador'    // ?vitral= in this tab, or localStorage
}
```

## Usage

```ts
import { devtools } from 'vitral/devtools'

if (import.meta.env.DEV) devtools()
```

Shows a "vitral" button in the corner of the page. With active overrides, the button shows how many (`vitral (2)`). The panel lists all of them, the ones from `?vitral=` in this tab and the ones stored in the browser, and has "Clear all".

## Parameters

| Option | Default | What it does |
| --- | --- | --- |
| `reload` | `true` | Reloads the page when an override changes |

## Returns

`devtools` returns the function that removes the panel. `getOverrides` returns the overrides stored in the browser. `setOverride(name, url)` stores an override in the browser; `url` can be an alias (`pr-123`), resolved by `configure({ devOverrides: { preview } })`. `setOverride(name, null)` removes the override from the tab and the browser. `activeOverrides` lists this page's overrides. `clearOverrides` removes all of them, like `?vitral=off`.

## watchLeaks

Warns when a remote leaves the page and leaves listeners on `window` or `document`, or an open `setInterval`.

Today, the leak only shows up as a slow page after many route changes, and the DevTools Memory panel doesn't say which remote it came from.

With vitral:

```ts
import { watchLeaks } from 'vitral/devtools'

if (import.meta.env.DEV) watchLeaks()
```

```
[vitral] cart saiu da página e deixou 2 itens: window.resize, setInterval. Use ctx.signal ou limpe no unmount.
```

```ts
watchLeaks(options?: { delay?: number; onLeak?: (r: LeakReport) => void }): () => void

interface LeakReport {
  name: string
  listeners: { target: 'window' | 'document'; type: string; stack?: string }[]
  intervals: { stack?: string }[]
}
```

| Option | Default | What it does |
| --- | --- | --- |
| `delay` | `200` | Wait after unmount before checking, in ms |
| `onLeak` | console warning | Receives each report |

- Each listener's owner comes from the call stack: files in the remote's folder.
- Listeners with `once` or `signal` don't count.
- Returns the function that turns it off. Use only in development.

## Notes

::: warning Warning
Outside `localhost`, overrides only work with `configure({ devOverrides })`. Never turn it on in production.
:::
