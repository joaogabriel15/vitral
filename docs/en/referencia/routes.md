# vitral/routes

One remote per route, in a host without a framework.

```ts
routes(map: Record<string, string>, options?: { links?: boolean; announce?: boolean }): () => void
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
| `options.announce` | `false` doesn't announce the new page or move focus after the remote changes. Default: `true` |

## Returns

`routes` returns the function that undoes it. `matchRoute` returns the matching route, or `null`.

## Notes

- The most specific route wins, in any order: `/product/new` beats `/product/:id`, and `/account` beats `/account/*`. On a tie, the first one.
- Two patterns that match the same paths (`/product/:id` and `/product/:slug`) log a warning.
- `<vitral-outlet wait-for="session">` mounts only once the `provide` key has a value.
- After the remote changes on a navigation, screen readers hear the remote's `h1` (or `document.title`) and focus moves to that `h1`. `announceRoute(el)` does the same for hosts with another router.
- Navigating inside the same remote doesn't remount.
- `outlet.props = {...}` passes props. `outlet.route` says which route is mounted.
- With React Router or Vue Router, use `<Remote>` in the route. See [Routes](/en/aprender/rotas).
