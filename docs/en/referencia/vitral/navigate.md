# navigate

Changes the page's URL. Every router reads the new URL.

```ts
navigate(url: string, options?: { replace?: boolean }): void
```

## Usage

```ts
import { navigate } from 'vitral'

navigate('/orders/42')
navigate('/login', { replace: true })
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `url` | New address |
| `options.replace` | `true` replaces the current history entry |

## Returns

Nothing.

## Notes

- Updates the history and fires `popstate`. React Router, Vue Router, Next, Nuxt and the other routers react.
- A URL on another origin reloads the page.
- Inside the remote, `ctx.navigate` does the same.
