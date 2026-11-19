# CLI

```bash
npx vitral types [remotes.json | name=url ...] [--base url] [--out file] [--check]
npx vitral registry [remotes.json | name=url ...] [--base url] [--out file] [--name name]
npx vitral add <remote ...> [--registry url|file] [--to remotes.json] [--base url] [--out file] [--force] [--no-types]
npx vitral mcp [--registry url|file]
npx vitral doctor [remotes.json | url | name=url ...] [--host url] [--origin url] [--base url] [--contract range] [--max-kb n] [--json]
npx vitral doctor --stats stats.json [--route /page] [--remote dist ...] [--top n] [--json]
npx vitral migrate [folder] [--from single-spa|module-federation] [--dry-run]
npx vitral canal <canal.json> [--stable x.y.z] [--canary x.y.z | off] [--percent n]
npx vitral dict <dist> --from <previous-dist> [--from ...] [--level n] [--no-dcb]
```

::: tip Note
The CLI's output messages are in Portuguese. The tables on this page say what each check means.
:::

## vitral types

Downloads each remote's `vitral.d.ts` and generates `vitral-env.d.ts` in the host.

```bash
npx vitral types remotes.json
npx vitral types cart=https://cdn.example.com/cart/vitral.json
```

After that, a wrong prop on `<Remote name="cart">` doesn't compile.

Each remote gets a line with the hash (`integrity`) of the manifest the type came from:

```ts
// vitral:hash "cart" sha384-…
```

## vitral types --check

Checks whether the types still match the published manifests, without rewriting the file. Useful in CI:

```bash
npx vitral types --check
```

A remote counts as outdated when its manifest changed, when it has no recorded hash, or when it left `remotes.json`. A manifest without `integrity` (a `vite dev`, for example) only produces a warning.

## `types` options

| Option | What it does |
| --- | --- |
| `--base url` | Base of the relative URLs in `remotes.json` |
| `--out file` | Generated file. Default `vitral-env.d.ts` |
| `--check` | Only checks the hashes. Writes nothing |

## `types` exit code

Exits with code `1` if any remote fails. With `--check`, also if any type is outdated or the generated file doesn't exist.

## vitral registry

Generates `vitral-registry.json` from the manifests: name, URL, `version`, `integrity` and the props type (from `vitral.d.ts`). Keeps `owner`, `framework` and `description` from the previous file. See [Registry and agents](/en/aprender/registro).

```bash
npx vitral registry remotes.json --name shop
```

| Option | What it does |
| --- | --- |
| `--base url` | Base of the relative URLs in `remotes.json` |
| `--out file` | Generated file. Default `vitral-registry.json` |
| `--name name` | Name of the registry |

Exits with code `1` if any manifest fails to download.

## vitral add

Copies remotes from the registry to the host's `remotes.json` and runs `vitral types`.

```bash
npx vitral add cart profile --registry https://cdn.example.com/vitral-registry.json
```

| Option | What it does |
| --- | --- |
| `--registry url\|file` | Registry. Default: `VITRAL_REGISTRY` or `vitral-registry.json` |
| `--to file` | The host's `remotes.json`. Default: `public/remotes.json` or `remotes.json`, whichever exists |
| `--base url` | Base of the relative URLs, for `vitral types` |
| `--out file` | Types file. Default `vitral-env.d.ts` |
| `--force` | Replaces the URL of a remote already in `remotes.json` with another one |
| `--no-types` | Doesn't run `vitral types` |

An object entry (`{ "url": …, "isolate": "shadow" }`) keeps the other options; only the URL changes. Exits with code `1` if a remote isn't in the registry, is already registered with another URL, or has no types.

## vitral mcp

MCP server over stdio, with the tools `list_remotes`, `get_remote` and `add_remote`. See [MCP server](/en/aprender/registro#mcp-server).

## vitral doctor

Downloads each remote's manifest and JS, as the host would, and says what prevents loading. It doesn't run the remote's code.

```bash
npx vitral doctor --host https://app.example.com
npx vitral doctor https://cdn.example.com/remotes.json --origin https://app.example.com --contract ^2
npx vitral doctor cart=https://cdn.example.com/cart/vitral.json --json
```

The remotes come as in `vitral types`: `name=url` pairs, the path of a `remotes.json` or, with nothing, the project's `public/remotes.json` or `remotes.json`. It also accepts the URL of a published `remotes.json` or of a `vitral.json`. Run it in the host project's folder: that's where the `index.html` and the installed React and Vue versions come from.

```
Host
  ✓ CSP encontrada (header de https://app.example.com)

cart (https://cdn.example.com/cart/vitral.json)
  ✓ CORS do manifesto: Access-Control-Allow-Origin *
  ✓ manifesto válido: cart 1.4.0
  ✗ CORS do JS: a resposta não tem Access-Control-Allow-Origin
      Causa: o navegador bloqueia https://cdn.example.com/cart/remote-a1b2.js lido a partir de https://app.example.com.
      O que fazer: configure o servidor de https://cdn.example.com para responder Access-Control-Allow-Origin: https://app.example.com (ou *).
  ✓ exporta default com mount
  ✓ integrity do manifesto confere

1 erro(s), 0 aviso(s).
```

`✓` passed, `✗` is an error, `!` is a warning. Each `✗` and `!` comes with the cause ("Causa") and what to do ("O que fazer"). In the example, the JS response is missing `Access-Control-Allow-Origin`.

### What is checked

| Check | Error when | Warning when |
| --- | --- | --- |
| Manifest | HTTP other than 200, server down, HTML instead of JSON, missing `entry` | The `entry` is on another origin than the manifest (needs `allowedOrigins`) |
| CORS of the manifest and the JS | No `Access-Control-Allow-Origin`, or with an origin other than the host's | The header has an origin, but the host's wasn't given |
| JS | A `Content-Type` that isn't JavaScript; the file exports neither `mount` nor a `default` with `mount` | A remote with only parts (`exposes`) and no `mount` |
| Integrity | The hash in `vitral.json` or the one pinned in `remotes.json` (`{ url, integrity }`) doesn't match the published JS; a `files` entry missing or with another hash | No `integrity` anywhere |
| Contract | The remote's `contract` version is outside the host's range (`--contract` or the entry's `contract` in `remotes.json`) | The host declares a range and the remote doesn't publish a version |
| `dedupe` dependencies | With a contract on, the `peers` range doesn't accept the version installed in the host | The range doesn't accept the host's version (two copies on the page); two remotes with ranges no version satisfies |
| Duplicate React or Vue | | The JS ships React or Vue, the host has it too, and the remote doesn't use `dedupe` |
| Size | The JS is over `--max-kb` (gzipped) | Without `--max-kb`, the JS is over 250 kB gzipped |
| CSP | `script-src` or `connect-src` don't include the manifest's or the JS's origin | No `blob:` in `script-src` with `integrity` (browsers that don't check each module's hash use `blob:`); `style-src` without the CSS origin |

The CSP comes from the header and the `<meta http-equiv>` of the `--host` page. Without `--host`, from the `<meta>` in the project's `index.html`.

The `mount` check reads the JS text. It finds `export function mount`, `export { x as mount }` and an `export default` in a file that has `mount`, but it doesn't run the module.

### Options

| Option | What it does |
| --- | --- |
| `--host url` | The host page. The origin (for CORS) and the CSP come from it. It's also the base of the relative URLs in a local `remotes.json` |
| `--origin url` | The host's origin for CORS, when there's no `--host` |
| `--base url` | Base of the relative URLs in `remotes.json` |
| `--contract range` | Contract range the host accepts, as in `configure({ contract })` |
| `--max-kb n` | Maximum JS size of each remote, in gzipped kB |
| `--json` | JSON output: `{ ok, errors, warnings, host, remotes: [{ name, url, checks }] }` |

Without `--host` or `--origin`, CORS is checked with an arbitrary origin: a header with a specific origin becomes a warning.

### In CI

Exits with code `1` if there's any `✗`. Warnings don't change the code.

```yaml
- run: npx vitral doctor https://staging.example.com/remotes.json --host https://staging.example.com --max-kb 200
```

### Host bytes on a route

```bash
npx vitral doctor --stats .next/stats.json --route /shop --remote ../shop/dist
```

With `--stats`, `doctor` reads the host's webpack stats and adds up what a route loads: Next's common code, `_app` and the page. The stats can come from `stats.toJson()`, from `webpack --json` or from `@next/bundle-analyzer` with `generateStatsFile`. Nothing runs: it's static analysis.

The output lists the heaviest packages and modules, and points out:

| Warning | What it usually is |
| --- | --- |
| Translations in the route's JS | Every language and namespace in the bundle. Load the active language on demand |
| Modules with no used export | A barrel without `"sideEffects": false`: webpack keeps the whole file |
| `share` offers with every export | The host build didn't find some remote's `vitral.json`, or the remote is older than 0.10 |
| Duplicate packages with a `--remote` | The host and the remote each ship their own copy. With the same major, it's a candidate for `share` in the host and `dedupe` in the remote |

`--remote` accepts the remote's `dist` folder or its `vitral.json`. To cross-check the packages, the remote needs the SBOM (`vitral({ sbom: true })`). `--route` accepts `/shop`, `pages/shop/[[...slug]]` or `/` for the home page. `--top n` changes how many packages and modules show up (15 by default).

## vitral migrate

Converts a single-spa app or a Module Federation remote into a vitral remote. Run it in the project folder:

```bash
npx vitral migrate --dry-run   # shows the diff, writes nothing
npx vitral migrate
```

The command finds the source through `package.json` (`single-spa`, `single-spa-*`) and the build files (`webpack.config.*`, `rspack.config.*`, `rsbuild.config.*`, `vite.config.*`, `module-federation.config.*`). Use `--from` when it can't tell.

It doesn't change the current build. The new files are:

| File | Content |
| --- | --- |
| `src/vitral-remote.js` (single-spa) | `reactRemote(Root)`, when the app uses `singleSpaReact` with only `rootComponent`. Otherwise, `singleSpaRemote(lifecycles)` from [`vitral/single-spa`](./single-spa) |
| `src/vitral/<Part>.js` (Module Federation) | One file per component in `exposes`, with the framework adapter (`reactRemote`, `vueRemote`…) |
| `vite.vitral.config.mjs` | The framework plugin and `vitral()`, with output to `dist-vitral/` |
| `package.json` | The `build:vitral` script |

A project with `tsconfig.json` gets `.ts` and `vite.vitral.config.mts`. A file that already exists isn't overwritten: running it again changes nothing.

At the end, the command lists what to do by hand: dependencies to install and what it doesn't convert.

### What doesn't migrate

| Source | Not converted | What to do |
| --- | --- | --- |
| single-spa | Root config (`registerApplication`, `activeWhen`) | `configure({ remotes })` and a host route or [`routes()`](./routes) |
| single-spa | `navigateToUrl`, `mountParcel` | `ctx.navigate`, `<Remote>` or `createSlot` |
| single-spa | `singleSpaReact` options beyond `rootComponent` (`errorBoundary`, `wrapWith`…) | The app stays wrapped with `singleSpaRemote` |
| Module Federation | `shared` | The plugin's [`dedupe`](/en/aprender/dedupe) option |
| Module Federation | `exposes` that isn't an object literal (variable, function) | The plugin's `exposes` by hand |
| Module Federation | Angular components | `angularRemote(Component)` by hand |
| Module Federation | The host's `remotes` | The command suggests `federationRemote` from [`vitral/federation`](./federation) |

A part of `exposes` is treated as a component when the file is `.jsx`, `.tsx`, `.vue` or `.svelte`, or when the name starts with a capital letter. The others are modules without UI, for `loadModule`.

Exits with code `1` if it finds neither single-spa nor Module Federation.

## vitral canal

Creates or edits a remote's channel (the `canal.json` from [Canary and rollback](/en/aprender/canary)) and shows the result. Without options, it only shows it.

```bash
npx vitral canal canal.json --stable 1.4.0                  # creates: { "stable": "1.4.0" }
npx vitral canal canal.json --canary 1.5.0 --percent 10     # canary for 10%
npx vitral canal canal.json --percent 50                    # changes only the percent
npx vitral canal canal.json --stable 1.5.0 --canary off     # promotes
npx vitral canal canal.json --stable 1.4.0                  # rolls back a version
```

| Option | What it does |
| --- | --- |
| `--stable x.y.z` | Version for those not in the canary. Required to create the channel |
| `--canary x.y.z` | The new version. Changing the version keeps the `percent` |
| `--canary off` | Removes the canary |
| `--percent n` | Share of users in the canary, from 0 to 100. Required on the first canary |

The channel's own fields (read by a `resolve`) stay as they are. Exits with code `1` if the change would make the channel invalid, and then writes nothing.

## vitral test

Runs in the remote's CI. See [Contracts between host and remote](/en/aprender/contratos).

```bash
npx vitral test --contract contracts/                    # replays the hosts' contracts
npx vitral test --since https://cdn.example.com/cart/vitral.json   # props diff against the published version
npx vitral test --contract contracts/ --since https://cdn.example.com/cart/vitral.json
```

| Option | What it does |
| --- | --- |
| `--contract file\|folder` | A `.contract.json` contract, or a folder with them. Can repeat |
| `--since url\|file` | Published `vitral.d.ts` (or the URL of `vitral.json` or of the folder) to compare with the local one |
| `--dir folder` | Build folder. Default `dist` |
| `--entry file` | The remote's JS module. Default: the `entry` from `<dir>/vitral.json` |
| `--types file` | Local `vitral.d.ts`. Default `<dir>/vitral.d.ts` |

Needs `happy-dom` installed (`npm i -D happy-dom`). Uses the project's TypeScript to check the props; without it, only the mount runs. Exits with code `1` if any case fails or if a props change would break the host.

## vitral dict

Pre-compresses each `.js` and `.css` in the dist using its previous version as a dictionary and writes `vitral-dict.json` for the `vitral/dict` middleware. Full recipe and numbers in [Compression dictionaries](/en/aprender/dicionarios).

```bash
npx vitral dict dist --from ../previous-dist
```

| Option | What it does |
| --- | --- |
| `--from folder` | Dist of a previous version. Required, can repeat |
| `--level n` | zstd level. Default: 19 |
| `--no-dcb` | Doesn't generate `.dcb` even with the `brotli` binary in PATH |

Writes `<file>.<hash>.dcz` (Node's zstd, 22.19+ or 24.6+) and, with the `brotli` binary, `<file>.<hash>.dcb`. Exits with code `1` if `--from` is missing, a folder doesn't exist, or Node has no zstd with dictionary support.

## vitral sign

Signs the dist's `vitral.json`, JS and CSS with Ed25519, for a host that pins the remote's key in `keys`. Full recipe in [Security](/en/aprender/seguranca#signatures).

```bash
npx vitral sign --keygen
VITRAL_SIGNING_KEY="$(cat key.pem)" npx vitral sign dist --base /cart/
```

| Option | What it does |
| --- | --- |
| `--keygen` | Creates the key pair and shows both |
| `--key-file file` | Private key in PEM. Without it, uses `VITRAL_SIGNING_KEY` |
| `--base path` | Public path of the folder on the server. Default: `/` |
| `--no-headers` | Writes only `vitral-signatures.json`, without `_headers` |

Run it last: any change to a file after that invalidates the signature. Exits with code `1` without the private key.
