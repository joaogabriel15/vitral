# shared

Reads and changes a shared context key.

```ts
shared<T>(key: string): SharedValue<T>
batch<R>(fn: () => R): R
```

## Usage

```ts
import { shared } from 'vitral'

const theme = shared('theme')
theme.get()                                 // 'light'
const stop = theme.subscribe((t) => {})     // calls now and on every change
shared('user').update((u) => ({ ...u, name: 'Caio' }))
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `key` | Key name |

## Returns

| Method | What it does |
| --- | --- |
| `get()` | Current value. `undefined` if nobody set one |
| `set(value)` | Replaces the value |
| `update(fn)` | Replaces it based on the current value |
| `subscribe(fn)` | Calls now and on every change. Returns the function that cancels |
| `key` | The key's name |

## batch

```ts
import { batch } from 'vitral'

batch(() => {
  user.set(next)
  cart.set([])
}) // each key notifies once, at the end
```

## Types

```ts
declare module 'vitral' {
  interface Shared {
    user: { id: number; name: string } | null
    theme: 'light' | 'dark'
  }
}
```

## Notes

- Inside the remote, `ctx.shared` is the same `shared`, with subscriptions cancelled on unmount.
- Each framework has a hook. See [Shared context](/en/aprender/contexto#in-each-framework).
- The context doesn't cross the [iframe](/en/aprender/iframe).
