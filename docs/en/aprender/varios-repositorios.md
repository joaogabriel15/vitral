# Multiple repositories

A portal with login, home and layout, and one area per repository: products, employees. Each repository has its own build and its own deploy. The user moves between areas without reloading the page.

```
portal/          host: login, layout, routes, session
products/        remote: /products/*
employees/       remote: /employees/*
```

## 1. Create the three repositories

```bash
npm create vitral@latest portal -- --host --framework react
npm create vitral@latest products -- --remote --framework react
npm create vitral@latest employees -- --remote --framework react
```

Both remotes come with port `5174`. Change the one in `employees` to run both at the same time:

```js
// employees/vite.config.js
server: { port: 5175 },
```

## 2. Remote: export the area

Each remote exports a component and has its own router, with the route base the portal reserves for it.

```jsx
// products/src/App.jsx
import { createBrowserRouter, RouterProvider } from 'react-router'

const router = createBrowserRouter(
  [
    { path: '/', element: <List /> },
    { path: '/:id', element: <Detail /> },
  ],
  { basename: '/products' },
)

export default function Products() {
  return <RouterProvider router={router} />
}
```

`vite build` writes `dist/vitral.json`. Publish `dist` to a CDN folder, for example `https://cdn.example.com/products/`.

## 3. Portal: one remote map per environment

The portal reads the list of remotes from a JSON file. Each environment publishes its own, with no portal rebuild.

```json
// portal/public/remotes.json (production)
{
  "products": "https://cdn.example.com/products/vitral.json",
  "employees": "https://cdn.example.com/employees/vitral.json"
}
```

```jsx
// portal/src/main.jsx
import { configure } from 'vitral'

configure({ remotes: '/remotes.json' })
```

Remotes from another origin that isn't in `remotes.json` are blocked. See [SRI and origins](./seguranca).

## 4. Portal: routes

One route per area. Each one renders the remote; the remote's router handles the rest of the path.

```jsx
// portal/src/App.jsx
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { Remote } from 'vitral/react'

const router = createBrowserRouter([
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <Home /> },
      { path: '/products/*', element: <Remote name="products" fallback={<Loading />} /> },
      { path: '/employees/*', element: <Remote name="employees" fallback={<Loading />} /> },
    ],
  },
  { path: '/login', element: <Login /> },
])

export const App = () => <RouterProvider router={router} />
```

To go from one area to another from inside a remote, use `navigate`. It updates the history and notifies every router on the page:

```jsx
import { navigate } from 'vitral'

<button onClick={() => navigate('/employees/42')}>See owner</button>
```

`navigate` to another origin reloads the page.

## 5. Shared session

The portal handles login and owns the session. The remotes read it.

```ts
// portal/src/session.ts
import { provide } from 'vitral'

export const session = provide('session', null, { writable: false })

export function signIn(user, token) {
  session.set({ user, getToken: () => token })
}
```

```jsx
// products/src/List.jsx
import { useShared } from 'vitral/react'

export function List() {
  const name = useShared('session', (s) => s?.user.name)
  return <h1>Products for {name}</h1>
}
```

For API calls, pass a function as `getToken` instead of the token. That way the remote always gets the current value.

To mount the remote only after login, use `waitFor`:

```jsx
// portal/src/App.jsx
<Remote name="products" waitFor="session" />
```

See [Waiting for the session](./contexto#waiting-for-the-session).

Declare the shape once, in a file copied to the three repositories (or in an internal package):

```ts
// vitral-shared.d.ts
declare module 'vitral' {
  interface Shared {
    session: { user: { id: number; name: string }; getToken(): string } | null
  }
}
```

More in [Shared context](./contexto).

## 6. Develop without running every repository

Run only the portal and the remote you are editing. The other remotes come from staging.

```bash
# in portal/, with public/remotes.json pointing to staging
npm run dev                # http://localhost:5173

# in products/
npm run dev                # http://localhost:5174
```

Open the portal swapping only the local remote:

```
http://localhost:5173/products?vitral=products@http://localhost:5174
```

`employees` keeps coming from staging. Editing `products` updates the portal without reloading. The swap stays in the tab: navigating the portal or reloading doesn't undo it. `?vitral=off` undoes it.

For people working only on a remote who don't want to run the portal, staging can turn on `devOverrides` and accept the same `?vitral=`. With a preview URL template, a link with the PR number swaps the remote for the preview deploy:

```jsx
// portal/src/main.jsx (staging build only)
configure({
  remotes: '/remotes.json',
  devOverrides: { preview: 'https://{name}-{ref}.preview.example.com' },
})
```

```
https://staging.example.com/products?vitral=products@pr-123
```

Don't turn it on in production. More in [Development and HMR](./desenvolvimento#link-to-a-pr-preview).

## 7. Deploy

| Repository | What it publishes | When |
| --- | --- | --- |
| `portal` | The app and the environment's `remotes.json` | When the portal changes |
| `products`, `employees` | `dist/` in a CDN folder | When the area changes |

A `products` deploy doesn't require a portal deploy. With versions in folders (`/products/1.4.0/`), change the URL in `remotes.json` to release or roll back a version. For people who already have the page open, see [Updates without reload](./atualizacoes). Cache and CSP: [Deploy](./deploy).
