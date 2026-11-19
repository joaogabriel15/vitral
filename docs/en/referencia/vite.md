# vitral/vite

The remote's build plugin. Generates the JS, the scoped CSS and `vitral.json`.

```ts
vitral(options?: VitralViteOptions): Plugin
```

## Usage

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/remote.tsx', dedupe: ['react'] })] }
```

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `entry` | `src/remote.*` or `src/App.*` | File whose `export default` is the remote |
| `adapter` | detected from the Vite plugins | `react`, `vue`, `svelte`, `solid`, `preact`, `angular`, `element`, or `false` |
| `name` | `name` from `package.json` | Name in `vitral.json` |
| `version` | `version` from `package.json` | Version in `vitral.json` |
| `scopeCss` | `true` | Prefixes the CSS. `'native'` uses `@scope`. See [Styles](/en/aprender/estilos#with-scope) |
| `theme` | none | `'host'`. See [Styles](/en/aprender/estilos) |
| `layers` | none | `'flatten'`. See [Styles](/en/aprender/estilos) |
| `renameRegisteredProperties` | `false` | See [Styles](/en/aprender/estilos) |
| `exposes` | none | Map `'./name' → file`. See [Exposes](/en/aprender/exposes) |
| `dedupe` | none | See [Dedupe](/en/aprender/dedupe) |
| `i18n` | none | Where the translations are, such as `'src/locales/{lng}.json'`. The page downloads only the open language. See [Translations](/en/aprender/traducoes) |
| `types` | `true` | Generates `vitral.d.ts` |
| `contract` | none | `{ version }`: contract version in `vitral.json`. See [Contract](/en/aprender/deploy#contract-between-host-and-remote) |
| `sbom` | `false` | Generates `sbom.cdx.json` (CycloneDX 1.6). See [SBOM](/en/aprender/seguranca#sbom) |
| `target` | none | `'mcp-app'`: generates only `mcp-app.html`, with inline JS and CSS. See [MCP App](/en/aprender/mcp-app) |
| `compileHints` | `false` | V8 compile hint on the files that run at mount. See [Loading](/en/aprender/carregamento#compile-at-once-chrome) |
| `versionDir` | `false` | Writes the build to `dist/<version>/`. See [Canary and rollback](/en/aprender/canary) |
| `next` | `false` | Builds code written for Next.js (`next/*`, `NEXT_PUBLIC_*`, tsconfig `paths`, `.svg` as a component). See [Next.js](/en/frameworks/next#code-written-for-next) |
| `sideEffectFree` | none | Packages treated as side-effect free, except their CSS. For a package published as source code without `sideEffects` in `package.json` |
| `shared` | none | Deprecated. Use `dedupe` |

## Output

```
dist/
  remote-[hash].js
  remote-[hash].css
  vitral.json
  vitral.d.ts
  sbom.cdx.json   (with sbom: true)
```

With `target: 'mcp-app'`, only `dist/mcp-app.html`.

## Notes

- An `export default` that already has `mount` is used as is.
- In `vite dev`, it serves a development `vitral.json`, with CORS and without SRI.
- The split build lists in `split.lazy` the chunks the remote only downloads later (the routes' `import()`), for `preload(name, { routes: true })`.
- The app's `build.rollupOptions.output` (or `rolldownOptions.output`) applies to both outputs. The options that split code (`manualChunks`, `advancedChunks`, `codeSplitting`) apply only to the split build: the single file stays a single file. With `dedupe`, `manualChunks` doesn't merge the own copy with the app's code.
