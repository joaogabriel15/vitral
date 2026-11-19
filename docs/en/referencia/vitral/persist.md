# persist

Stores a shared key in the browser and mirrors it across tabs.

```ts
persist<V>(value: V, options?: PersistOptions): V
syncTabs<V>(value: V): V
serializeShared(values: Record<string, unknown>): string
```

## Usage

```ts
import { persist, provide, syncTabs } from 'vitral'

const cart = syncTabs(persist(provide('cart', []), { version: 1 }))
```

## Parameters

| `persist` option | Default | What it does |
| --- | --- | --- |
| `storage` | `'local'` | `'local'` or `'session'` |
| `version` | `1` | Format version. Bump it when the value's format changes |

## Returns

The same object it received.

## serializeShared

On the server, turns values into JSON safe for `<script>`:

```ts
import { serializeShared } from 'vitral'

const html = `<script type="application/json" data-vitral-shared>${serializeShared({ user })}</script>`
```

See [SSR](/en/aprender/ssr).

## Notes

- The storage key is `vitral:<key>:<version>`.
- Values that can't become JSON aren't stored.
- Without storage (server, blocked private mode), it does nothing.
- Call `syncTabs` on the owner.
