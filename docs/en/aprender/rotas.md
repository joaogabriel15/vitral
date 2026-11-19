# Routes

Mounts one remote per route, in a host without a framework or with the host's router.

## When to use each

- App shell without a framework: use `routes()` and `<vitral-outlet>`.
- Host with React Router, Vue Router, Next or Nuxt: render `<Remote>` in the route.

## App shell with `vitral/routes`

```html
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: '/remotes.json' })
  routes({
    '/checkout/*': 'checkout',   // /checkout and everything below it
    '/account': 'account',       // only /account
    '/product/:id': 'product',
    '/': 'home',
    '*': 'not-found',
  })
</script>

<nav><a href="/account">Account</a> <a href="/checkout">Checkout</a></nav>

<vitral-outlet isolate="shadow">
  <p slot="fallback">Loading…</p>
  <p slot="error">Unavailable</p>
  <p slot="empty">Page not found</p>
</vitral-outlet>
```

- The first route that matches wins.
- Navigating inside the same remote (`/checkout/payment`) doesn't remount.
- Same-origin `<a href>` links navigate without reloading.
- `outlet.props = {...}` passes props. `outlet.route` says which route is mounted.

| Function or option | What it does |
| --- | --- |
| `routes(map, { links })` | Defines the routes. Returns the function that undoes it. `links: false` doesn't intercept links |
| `matchRoute(path)` | Returns `{ name, pattern, params }` or `null` |
| `defineVitralOutlet(tag?)` | Registers the element under another name |

## With the host's router

```jsx
const router = createBrowserRouter([
  { path: '/account/*', element: <Remote name="account" /> },
  { path: '/checkout/*', element: <Remote name="checkout" /> },
])
```

The remote can have its own router with the route base:

```jsx
const router = createBrowserRouter(routes, { basename: '/account' })
export default reactRemote(() => <RouterProvider router={router} />)
```

To leave the base from inside the remote, use `navigate('/checkout')`.
