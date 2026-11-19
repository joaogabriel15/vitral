# Development and HMR

Run the remote with `vite dev` and see the changes in the host without reloading.

## When to use it

Whenever you are editing a remote.

## HMR

```bash
# in the remote
npx vite --port 5174
```

```ts
// in the host
configure({ remotes: { cart: 'http://localhost:5174/vitral.json' } })
```

`vite dev` serves a development `vitral.json`, with CORS and without SRI. Editing the remote updates the host.

## Swap a remote through the URL

```
http://localhost:3000/?vitral=cart@http://localhost:5174
```

Swaps a remote's URL without touching the host. The other remotes keep coming from the URLs the host registered (staging, for example). Works on `localhost`. Elsewhere, only with `configure({ devOverrides })`. Never turn it on in production.

To swap more than one, separate them with commas: `?vitral=cart@http://localhost:5174,account@http://localhost:5175`.

The swap is stored in the tab (`sessionStorage`). It keeps working after reloading or navigating to a URL without `?vitral=`. Closing the tab drops it.

## Link to a PR preview

With a URL template, the swap accepts an alias instead of the URL:

```ts
configure({
  remotes: '/remotes.json',
  devOverrides: { preview: 'https://{name}-{ref}.preview.example.com' },
})
```

```
https://staging.example.com/?vitral=checkout@pr-123
```

`checkout` now comes from `https://checkout-pr-123.preview.example.com/vitral.json`. `{name}` is the remote's name and `{ref}` is the alias. Without `/vitral.json` at the end, vitral adds it. The alias can be `pr-123`, `main` or `1.4.0`.

Send that link in the PR to whoever is reviewing. The rest of the page keeps coming from staging.

The object in `devOverrides` turns swaps on, like `true`. Pass the object only in environments that aren't production:

```ts
devOverrides: import.meta.env.VITE_ENV !== 'production' && { preview: 'https://{name}-{ref}.preview.example.com' },
```

Without `preview`, the alias is ignored with a warning in the console.

## See and clear active swaps

Each swap writes a warning to the console the first time the remote loads:

```
[vitral] override ativo: checkout → https://checkout-pr-123.preview.example.com/vitral.json (aba). Para limpar: ?vitral=off
```

| In the URL | What it does |
| --- | --- |
| `?vitral=name@url` | Swaps `name` for `url` in this tab |
| `?vitral=name@pr-123` | Swaps `name` for the preview (needs `preview`) |
| `?vitral=name@off` | Removes the swap for `name` |
| `?vitral=off` | Removes every swap (tab and browser) |

To keep swaps in every tab, use the panel:

```ts
import { devtools } from 'vitral/devtools'

devtools() // "vitral" button in the corner of the page
```

The button shows how many swaps are active, for example `vitral (2)`. The panel lists each one with its source: tab (came from `?vitral=`) or browser (stored in `localStorage`). You can remove one or clear them all.

| Option | Default | What it does |
| --- | --- | --- |
| `devOverrides` (`configure`) | `false` | `true` accepts `?vitral=` outside `localhost`. `{ preview }` does the same and resolves aliases |
| `reload` (`devtools`) | `true` | Reloads the page when a swap changes |

## Props types

The remote build publishes `vitral.d.ts`. In the host:

```bash
npx vitral types
```

Generates `vitral-env.d.ts` from `remotes.json`. A wrong prop on `<Remote name="cart">` no longer compiles.

If the remote uses only TypeScript 7, also install `typescript@5` as a dev dependency: TypeScript 7 doesn't yet have the API the plugin uses to read the props.

In CI, `npx vitral types --check` fails if any remote changed its types since the last generation. Then run `npx vitral types` again.

| Option | What it does |
| --- | --- |
| `types` (plugin) | `false` doesn't generate `vitral.d.ts`. Default `true` |
| `--base url` | Base for the relative URLs in `remotes.json` |
| `--out file` | Generated file. Default `vitral-env.d.ts` |
| `--check` | Only checks the hashes, without rewriting. Exit code `1` if any changed |
