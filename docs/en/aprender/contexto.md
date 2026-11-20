# Shared context

State and services that the host and remotes read and change together: user, theme, cart.

## When to use it

When several remotes need the same value and must see its changes. For data of a single instance, use [props](./props-eventos). For messages without state, use [events](./props-eventos#events).

## Create and read

```ts
// host: creates the value and becomes its owner
import { provide } from 'vitral'

const user = provide('user', { id: 42, name: 'Ana' })
provide('theme', 'light', { writable: false })      // only the owner changes it
provide('auth', { getToken: () => session.token })  // services too
user.set({ id: 7, name: 'Bia' })                    // every remote updates
```

```ts
// any remote
import { shared } from 'vitral'

const theme = shared('theme')
theme.get()                                  // 'light'
const stop = theme.subscribe((t) => {})      // calls now and on every change
shared('user').update((u) => ({ ...u, name: 'Caio' }))
```

| Method | What it does |
| --- | --- |
| `get()` | Current value. `undefined` if nobody set one |
| `set(value)` | Replaces the value |
| `update(fn)` | Replaces it based on the current value |
| `subscribe(fn)` | Calls now and on every change. Returns the function that cancels |

| `provide` option | Default | What it does |
| --- | --- | --- |
| `writable` | `true` | `false`: only the owner changes it. Another `set` throws [`SHARED_READONLY`](/en/erros/SHARED_READONLY) in development |

The first `provide` of a key is its owner. A second `provide` of the same key writes nothing.

## In each framework

| Framework | How to read |
| --- | --- |
| React, Preact | `useShared('user', (u) => u?.name)` |
| Vue | `useShared('theme')`, a writable ref |
| Solid | `useShared('user')`, an accessor |
| Angular | `injectShared('user')`, a `Signal` |
| Svelte | `$theme`, with `const theme = shared('theme')` |
| Lit | `new SharedController(this, 'user')` |

With a selector, the component only re-renders when the result changes.

Inside the remote, `ctx.shared` is the same `shared`, but subscriptions made through it are cancelled on unmount.

## Waiting for the session

A remote that reads the session right in `mount` breaks if the host hasn't logged in yet.

Today (Module Federation, single-spa, Multi-Zones), the host holds the mount back with its own code:

```jsx
// shell/src/App.jsx
const session = useSession()
return session ? <Account /> : <p>Loading…</p>
```

With vitral, the component waits for the `provide` key to have a value (neither `undefined` nor `null`):

```jsx
// shell/src/App.jsx
<Remote name="account" waitFor="session" fallback={<p>Loading…</p>} />
```

- While it waits, it shows the `fallback`. The remote's download already starts.
- Accepts a list: `waitFor={['session', 'theme']}`.
- On `<vitral-remote>` and `<vitral-outlet>`: `wait-for="session theme"`.
- Works in React, Vue, Svelte, Solid, Preact and Web Components.

## Types

Declare once, in the host and in each remote:

```ts
declare module 'vitral' {
  interface Shared {
    user: { id: number; name: string } | null
    theme: 'light' | 'dark'
  }
}
```

## Several changes at once

```ts
import { batch } from 'vitral'

batch(() => {
  user.set(next)
  cart.set([])
}) // each key notifies once, at the end
```

## Store in the browser and mirror across tabs

```ts
import { persist, provide, syncTabs } from 'vitral'

const cart = syncTabs(persist(provide('cart', []), { version: 1 }))
```

| `persist` option | Default | What it does |
| --- | --- | --- |
| `storage` | `'local'` | `'local'` or `'session'` |
| `version` | `1` | Format version. Bump it when the value's format changes |

`syncTabs` mirrors changes between tabs of the same origin. Call it on the owner.

To carry values from the server to the client, see [SSR](./ssr).
