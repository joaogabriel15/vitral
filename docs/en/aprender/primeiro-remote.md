# Your first remote

A remote is a component the host downloads and mounts at runtime.

## 1. Export the component

Export the component as `default`:

```jsx
// src/App.jsx
export default function Cart({ userId }) {
  return <p>Cart for user {userId}</p>
}
```

## 2. Add the plugin

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

The plugin detects the framework from the Vite plugins and looks for the entry in `src/remote.*` or `src/App.*`. For another file, use `vitral({ entry: 'src/Cart.jsx' })`.

## 3. Build

```bash
npx vite build
```

```
dist/
  remote-[hash].js
  remote-[hash].css
  vitral.json
```

`vitral.json` tells the host which JS and which CSS to download, with the hash of each file.

## 4. Deploy

Deploy the `dist` folder to any CDN with CORS enabled. See [Deploy](./deploy).

## During development

```bash
npx vite --port 5174
```

`vite dev` serves a `vitral.json` at `http://localhost:5174/vitral.json`. The host gets the changes without reloading. See [Development and HMR](./desenvolvimento).

::: tip Note
The same steps work for Vue, Svelte, Solid, Preact, Angular and Lit. See your [framework](/en/frameworks/react)'s page.
:::
