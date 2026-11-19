# provide

Creates a shared context key and becomes its owner.

```ts
provide<T>(key: string, value: T, options?: { writable?: boolean }): ProvidedValue<T>
```

## Usage

```ts
import { provide } from 'vitral'

const user = provide('user', { id: 42, name: 'Ana' })
provide('theme', 'light', { writable: false })
provide('auth', { getToken: () => session.token })

user.set({ id: 7, name: 'Bia' })
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `key` | Key name |
| `value` | Initial value. It may have functions |
| `options.writable` | `false`: only the owner changes it. Default `true` |

## Returns

The same object as [`shared`](./shared): `get`, `set`, `update`, `subscribe`. The owner can always call `set`.

## Notes

- The first `provide` of a key is its owner. A second `provide` of the same key writes nothing.
- On a key with `writable: false`, `set` from elsewhere throws [`SHARED_READONLY`](/en/erros/SHARED_READONLY) in development.
- Treat the value as immutable. To change it, pass a new value.
