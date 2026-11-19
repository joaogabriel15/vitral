# Your first host

The host is the page that shows the remotes. Its build doesn't change: it only calls `configure()` with the URLs.

## 1. Register the remotes

```js
import { configure } from 'vitral'

configure({
  remotes: { cart: 'https://cdn.example.com/cart/vitral.json' },
})
```

Call it once, before rendering. The URLs can also come from a JSON file: `configure({ remotes: '/remotes.json' })`.

## 2. Show the remote

```jsx
import { Remote } from 'vitral/react'

export function App() {
  return (
    <Remote
      name="cart"
      props={{ userId: 42 }}
      fallback={<p>Loading…</p>}
      error={(error, retry) => <button onClick={retry}>Try again</button>}
    />
  )
}
```

- `fallback` shows while the remote downloads.
- `error` shows if the remote fails. The rest of the page keeps working.
- Changing `props` updates the remote without remounting it.

## 3. Point to the local remote

During development, use the URL of the remote's `vite dev`:

```js
configure({ remotes: { cart: 'http://localhost:5174/vitral.json' } })
```

## Other frameworks

| Host | Component |
| --- | --- |
| React, Next | `<Remote>` from `vitral/react` |
| Vue, Nuxt | `<VitralRemote>` from `vitral/vue` |
| Angular | `provideVitral()` and `<vitral-remote>` |
| Svelte | `use:remote` from `vitral/svelte` |
| Solid | `<Remote>` from `vitral/solid` |
| Preact | `<Remote>` from `vitral/preact` |
| HTML, Lit, others | `<vitral-remote>` from `vitral/element` |

## Without `configure`

Pass the URL straight to the component:

```jsx
<Remote src="https://cdn.example.com/cart/vitral.json" />
```
