<script setup>
import { withBase } from 'vitepress'
</script>

# Dependency dedupe

Makes the remote use the React or Vue already on the page, instead of downloading another copy.

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/dedupe-en.png')" alt="Without dedupe, each remote downloads its own React. With dedupe, the remotes use the React already on the page when the version fits; the one that doesn't fit downloads its own.">
  <img class="so-escuro" :src="withBase('/marca/dedupe-escuro-en.png')" alt="">
</picture>

## When to use it

When several remotes use the same framework and you want to download it only once. Without `dedupe`, each remote ships its own copy and there is never a version conflict.

## Code

```js
// remote's vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ dedupe: ['react'] })] }
```

- The remote uses the page's copy when the version fits: the `^` range of the version installed in the remote.
- When it doesn't fit, or there's no copy on the page, it downloads its own.
- `<Remote>` from `vitral/react` offers the host's React with no configuration.
- `['react']` covers the whole group: `react`, `react-dom`, `react-dom/client` and the JSX runtime.

- `'package/*'` covers the package and every path it exports. Use it for your company's component library.
- An import that reaches a file inside the package (through an alias or tsconfig `paths`) also uses the page's copy, name by name. A name the package doesn't export comes from the remote's own copy of the file that defines it, and the build says which one.
- After the build, a warning counts the package files that end up in the remote's main code, with a path to them. Those files download and run even when the page offers the package.

| Option | Example | What it does |
| --- | --- | --- |
| `dedupe` | `['react']`, `['vue']`, `['@company/ui/*']` | Dependencies the remote takes from the page when the version fits |
| `shared` (deprecated) | `['react', 'react-dom/client']` | Leaves them out of the bundle and expects an import map in the host. Prefer `dedupe` |

The host offers other dependencies with `configure({ dedupe })`. With a function in `modules`, they only load when a remote asks for them, and don't weigh on the initial bundle:

```ts
configure({
  dedupe: {
    i18next: { version: '25.1.0', modules: () => import('i18next').then((m) => ({ i18next: m })) },
  },
})
```

In a Next host, `share` in [`withVitral`](/en/frameworks/next#next-host-instead-of-zones) generates this with the installed versions.

If the host's offer lacks something the remote uses, the remote downloads its own copy and warns in the console. React is the exception: the remote keeps the host's and only warns, because two copies on the page break hooks and context.

## One version for every remote

In the browser, each remote takes the first offer that fits, in the order it arrives. With one remote on `^1.0.0` (copy 1.2) and another on `^1.3.0` (copy 1.4), when the first one arrives first, the page downloads both, even though 1.4 fits both.

With the manifests of every remote, `planDedupe` picks for each group the smallest set of versions that meets every range: the host's offer first, then the newest. Each remote gets the copy it should use, even if it comes from another remote:

```ts
import { configure, planDedupe } from 'vitral'

const { plan, notes } = planDedupe(
  { a: { url: '/a/vitral.json', manifest: manifestA }, b: { url: '/b/vitral.json', manifest: manifestB } },
  { react: '19.2.0' }, // what the host offers
)
configure({ dedupePlan: plan })
```

- `notes` explains, in text, each group where the ranges have no version in common and how many copies the page will download.
- The plan carries each copy's hash, and SRI checks it as always.
- If a remote publishes another version, it goes back to its own copy until the plan is rebuilt.
- In the Next host, `withVitral` computes the plan at build time, with the manifests it finds (in `public/` or `manifestFile`), and reports conflicts in the terminal.
