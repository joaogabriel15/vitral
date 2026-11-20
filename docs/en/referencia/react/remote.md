# &lt;Remote&gt;

Shows a remote in a React or Next host.

```tsx
<Remote name="cart" props={{ userId: 42 }} />
```

## Usage

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

export function App() {
  const [userId, setUserId] = useState(42)
  return (
    <Remote
      name="cart"
      props={{ userId, onCheckout: (order) => console.log(order) }}
      fallback={<p>Loading…</p>}
      error={(error, retry) => <button onClick={retry}>Try again</button>}
      onError={(error) => console.error(error.code)}
    />
  )
}
```

## Props

| Prop | Type | What it does |
| --- | --- | --- |
| `name` | `string` | Name registered in `configure` |
| `src` | `string` | URL of `vitral.json`. No `configure` needed |
| `props` | `object` | Remote props. Functions work too |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolation. See [Styles](/en/aprender/estilos) |
| `fallback` | `ReactNode` | Shown while loading |
| `error` | `ReactNode` or `(error, retry) => ReactNode` | Shown if it fails |
| `onError` | `(error) => void` | Called on each error |
| `className` | `string` | Class of the element that receives the remote |
| `loading` | `'lazy' \| 'idle'` | When to mount. See [Loading](/en/aprender/carregamento) |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Download before mounting |
| `priority` | `'high'` | High priority for the downloads |
| `keepAlive` | `boolean \| number` | Keeps the remote mounted when leaving the page |
| `waitFor` | `string \| string[]` | `provide` keys that must have a value before mounting. See [Waiting for the session](/en/aprender/contexto#waiting-for-the-session) |

## Notes

- Changing `props` updates the remote. Changing `name`, `src` or `isolate` remounts it.
- On the server, it renders only the `fallback`. The remote mounts on the client, with no hydration error. It already has `'use client'`.
- Offers the host's React to remotes with [`dedupe: ['react']`](/en/aprender/dedupe).
- With `npx vitral types`, props are checked by name. See [CLI](/en/referencia/cli).
