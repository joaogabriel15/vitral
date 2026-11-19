# vitral/routes

One remote per route, in a host without a framework.

```ts
routes(map: Record<string, string>, options?: { links?: boolean }): () => void
matchRoute(path: string): { name, pattern, params } | null
defineVitralOutlet(tag?: string): void
```

## Usage

```html
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: '/remotes.json' })
  routes({
    '/checkout/*': 'checkout',
    '/product/:id': 'product',
    '/': 'home',
    '*': 'not-found',
  })
</script>

<vitral-outlet isolate="shadow">
  <p slot="fallback">Loading…</p>
  <p slot="error">Unavailable</p>
  <p slot="empty">Page not found</p>
</vitral-outlet>
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `map` | Path pattern → remote name |
| `options.links` | `false` doesn't intercept clicks on `<a>` |

## Returns

`routes` returns the function that undoes it. `matchRoute` returns the matching route, or `null`.

## Notes

- The first matching route wins.
- Navigating inside the same remote doesn't remount.
- `outlet.props = {...}` passes props. `outlet.route` says which route is mounted.
- With React Router or Vue Router, use `<Remote>` in the route. See [Routes](/en/aprender/rotas).
