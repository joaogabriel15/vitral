# Installation

## New project

```bash
npm create vitral@latest
```

Generates a host and a remote ready to run.

## Existing project

Install in the host and in each remote:

::: code-group

```bash [npm]
npm install vitral
```

```bash [pnpm]
pnpm add vitral
```

```bash [yarn]
yarn add vitral
```

:::

The adapters use the React, Vue, Angular, Svelte, Solid or Preact already in the project. The host only downloads the code of the adapter it imports.

## Entry points

| Import | For |
| --- | --- |
| `vitral` | Core: `configure`, `events`, `provide`, `shared` |
| `vitral/vite` | Remote build plugin |
| `vitral/react`, `vitral/vue`, `vitral/angular`, `vitral/svelte`, `vitral/solid`, `vitral/preact` | Host and remote in each framework |
| `vitral/element` | `<vitral-remote>` and Web Component remotes |
| `vitral/auto` | Registers `<vitral-remote>` on import |
| `vitral/routes` | Routes without a framework |
| `vitral/iframe` | Iframe isolation |
| `vitral/testing` | Fake remotes for tests |
| `vitral/devtools` | Panel to swap URLs during development |

The full list is in the [Reference](/en/referencia/).

## Without a bundler

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>
```

## Requirements

- Browsers with ES modules.
- Vite 5 or newer in the remote, to use the plugin. Without the plugin, see [Other bundlers](/en/referencia/vitral/configure#other-bundlers).
