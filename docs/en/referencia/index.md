# API reference

Each page shows the signature, parameters, return value and an example.

## vitral

| Function | For |
| --- | --- |
| [`configure`](./vitral/configure) | Register remotes and host options |
| [`register`](./vitral/register) | Register a remote later |
| [`defineRemote`](./vitral/define-remote) | Write a remote by hand |
| [`mountRemote`](./vitral/mount-remote) | Mount without a component |
| [`createSlot`](./vitral/create-slot) | Mount with state and retry |
| [`loadModule`](./vitral/load-module) | Download without mounting |
| [`events`](./vitral/events) | Events between host and remotes |
| [`navigate`](./vitral/navigate) | Change page |
| [`provide`](./vitral/provide) | Create shared state |
| [`shared`](./vitral/shared) | Read and change shared state |
| [`persist`](./vitral/persist) | Store state in the browser |
| [`component`](./vitral/component) | Remote in plain JS |
| [`watchUpdates`](./vitral/updates) | Switch versions without reload |
| [`RemoteError`](./vitral/remote-error) | Errors |

## Frameworks

| Import | Host | Remote |
| --- | --- | --- |
| [`vitral/react`](./react/remote) | [`<Remote>`](./react/remote) | [`reactRemote`](./react/react-remote), [hooks](./react/hooks) |
| [`vitral/vue`](./vue) | `<VitralRemote>` | `vueRemote` |
| [`vitral/angular`](./angular) | `provideVitral` | `angularRemote` |
| [`vitral/svelte`](./svelte) | `use:remote` | `svelteRemote` |
| [`vitral/solid`](./solid) | `<Remote>` | `solidRemote` |
| [`vitral/preact`](./preact) | `<Remote>` | `preactRemote` |
| [`vitral/element`](./element) | `<vitral-remote>` | `elementRemote` |

## Tools

| Import | For |
| --- | --- |
| [`vitral/vite`](./vite) | Remote build plugin |
| [`vitral/routes`](./routes) | Routes without a framework |
| [`vitral/prefetch`](./prefetch) | Preload the next route's remote |
| [`vitral/iframe`](./iframe) | Iframe isolation |
| [`vitral/testing`](./testing) | Fake remotes in tests |
| [`vitral/devtools`](./devtools) | Swap URLs during development |
| [`vitral/sentry`](./monitoramento#vitral-sentry) | Errors in Sentry |
| [`vitral/otel`](./monitoramento#vitral-otel) | Errors and Web Vitals in OpenTelemetry |
| [`vitral/vitals`](./vitals) | Web Vitals per remote and per route |
| [`vitral/single-spa`](./single-spa) | A single-spa app as a remote |
| [`vitral/federation`](./federation) | A Module Federation remote in the host |
| [`vitral/dict`](/en/aprender/dicionarios) | Server with compression dictionaries (delta between deploys) |
| [`vitral/edge`](./edge) | Edge gateway: a single origin, Early Hints and remote SSR |
| [CLI](./cli) | Props types and migration |

The TypeDoc reference, with every type, is at [/api/](/api/) (generated from the source comments, in Portuguese).
