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

- The most specific route wins, in any order: `/product/new` beats `/product/:id`, and `/account` beats `/account/*`.
- Two patterns that match the same paths log a warning.
- Navigating inside the same remote (`/checkout/payment`) doesn't remount.
- Same-origin `<a href>` links navigate without reloading.
- `outlet.props = {...}` passes props. `outlet.route` says which route is mounted.

| Function or option | What it does |
| --- | --- |
| `routes(map, { links, announce })` | Defines the routes. Returns the function that undoes it. `links: false` doesn't intercept links. `announce: false` turns off the announcement and focus |
| `<vitral-outlet wait-for="session">` | Mounts only once the `provide` key has a value. See [Waiting for the session](./contexto#waiting-for-the-session) |
| `matchRoute(path)` | Returns `{ name, pattern, params }` or `null` |
| `defineVitralOutlet(tag?)` | Registers the element under another name |

## Screen readers and focus

In a SPA, the URL changes and focus stays on the clicked link. Screen reader users hear nothing. With several remotes on the page, none of them knows it's its turn to announce.

Today (Module Federation, single-spa, Multi-Zones), each team writes its own announcement, or nobody does:

```js
// shell/src/routes.js
window.addEventListener('single-spa:app-change', () => {
  const h1 = document.querySelector('main h1')
  h1?.setAttribute('tabindex', '-1')
  h1?.focus()
  document.getElementById('notice').textContent = h1?.textContent ?? document.title
})
```

With vitral, `<vitral-outlet>` does it on its own after each remote change:

```js
// shell/src/routes.js (instead of the listener)
routes({ '/account': 'account', '/': 'home' })
```

- Announces the remote's `h1` (or `document.title`) in an `aria-live` region.
- Moves focus to that `h1`, without scrolling the page.
- Does nothing on the first load: the browser already announces the page.
- `routes(map, { announce: false })` turns it off.

With another router, call `announceRoute` when `<vitral-remote>` is ready:

```js
import { announceRoute } from 'vitral/routes'

document.addEventListener('vitral-ready', (e) => e.target.matches('vitral-remote') && announceRoute(e.target))
```

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
