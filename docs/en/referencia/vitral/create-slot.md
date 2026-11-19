# createSlot

Handles a remote's lifecycle in an element: mounts, updates, swaps and shows the state. The host components use this underneath.

```ts
createSlot<P>(target: HTMLElement, options: SlotOptions<P>): RemoteSlot<P>
```

## Usage

```ts
import { createSlot } from 'vitral'

const slot = createSlot(el, {
  name: 'cart',
  props: { userId: 42 },
  onStatus(status, error) {
    el.dataset.status = status
  },
})

slot.update({ userId: 43 })
slot.set({ name: 'cart-v2' })
slot.retry()
slot.destroy()
```

## Parameters

| Option | What it is |
| --- | --- |
| `name` | Registered name |
| `src` | URL of `vitral.json`. No `configure` needed |
| `props` | Initial props |
| `isolate` | `'none'`, `'shadow'`, `'iframe'` or `'reframe'` |
| `priority` | `'high'` |
| `styles` | Host styles in the Shadow DOM |
| `onStatus(status, error)` | Called on every change: `'loading'`, `'ready'` or `'error'` |

## Returns

| Member | What it does |
| --- | --- |
| `update(props)` | Updates without remounting |
| `set({ name, src, isolate })` | Swaps the remote or the isolation. Remounts |
| `retry()` | Mounts again |
| `destroy()` | Unmounts and cleans up |
| `status` | Current state |

## Notes

- Late responses from a previous remote are ignored.
