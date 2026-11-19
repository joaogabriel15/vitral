# Benchmark against Module Federation and Multi-Zones

The vitral host and a host using the official Module Federation (MF) runtime loading the same N remotes, in Chromium, on a fixed slow network. Every number below comes from `bench/publico/run.mjs`, on the machine listed in [Versions](#versions-and-machine).

The comparison with Next.js Multi-Zones, which splits the app by route rather than by part of the page, is in [Against Next.js Multi-Zones](#against-next-js-multi-zones).

## Results

Median of 7 runs. "Slow 4G" network (150 ms RTT, 1.6 Mbps). No CPU throttling. kB = 1024 bytes, with brotli and HTTP headers.

| Scenario | N | Cold (ms) | Warm (ms) | Transferred cold (kB) | Requests cold | Requests warm | Heap (MB) |
| --- | --: | --: | --: | --: | --: | --: | --: |
| vitral, no dedupe | 1 | 1053 | 392 | 71.6 | 14 | 2 | 1.72 |
| vitral, with dedupe | 1 | 1104 | 402 | 75.8 | 19 | 2 | 1.75 |
| vitral, dedupe and `maxStale` | 1 | 1112 | 253 | 76.2 | 20 | 1 | 1.76 |
| MF, no shared | 1 | 1466 | 392 | 100.4 | 7 | 2 | 1.84 |
| MF, shared singleton | 1 | 2605 | 420 | 110.9 | 17 | 2 | 2.14 |
| vitral, no dedupe | 4 | 1747 | 468 | 211.2 | 20 | 5 | 2.72 |
| vitral, with dedupe | 4 | 1532 | 450 | 131.0 | 38 | 5 | 2.32 |
| vitral, dedupe and `maxStale` | 4 | 1668 | 298 | 131.4 | 39 | 1 | 2.33 |
| MF, no shared | 4 | 2397 | 460 | 308.6 | 22 | 5 | 3.13 |
| MF, shared singleton | 4 | 3586 | 480 | 247.0 | 48 | 5 | 3.61 |
| vitral, no dedupe | 8 | 2818 | 553 | 409.3 | 28 | 9 | 3.99 |
| vitral, with dedupe | 8 | 2114 | 531 | 152.6 | 60 | 9 | 2.60 |
| vitral, dedupe and `maxStale` | 8 | 2266 | 348 | 153.3 | 62 | 6 | 2.60 |
| MF, no shared | 8 | 3783 | 592 | 597.9 | 42 | 9 | 4.91 |
| MF, shared singleton | 8 | 4467 | 946 | 408.6 | 85 | 12 | 5.17 |

Host alone (N=0): vitral's downloads 8.5 kB of JS in 6 requests (the entry and the on-demand chunks that `configure` fetches). MF's downloads 18.9 kB in 2 requests.

The minimum and maximum of each cell are in `bench/publico/resultado.json`.

In 0.11.1, the Vue and plain JS remotes stopped carrying host code (`<vitral-remote>` and the loader), and the React remotes stopped downloading the portal scope in a separate file. With N=8 and dedupe, this removed 14 requests and 25 kB from the cold visit. Measurements before 0.11.1 used the Chromium 141 headless shell; these use Chromium 153.

## What the numbers say

With the framework shared (dedupe in vitral, `shared` singleton in MF):

| N | Cold | Transferred | Heap |
| --: | --- | --- | --- |
| 1 | vitral 1104 ms, MF 2605 ms (-58%) | 75.8 kB vs 110.9 kB (-32%) | 1.75 vs 2.14 MB |
| 4 | vitral 1532 ms, MF 3586 ms (-57%) | 131.0 kB vs 247.0 kB (-47%) | 2.32 vs 3.61 MB |
| 8 | vitral 2114 ms, MF 4467 ms (-53%) | 152.6 kB vs 408.6 kB (-63%) | 2.60 vs 5.17 MB |

Each remote carries its own copy of the framework (no dedupe, no `shared`):

| N | Cold | Transferred | Heap |
| --: | --- | --- | --- |
| 1 | vitral 1053 ms, MF 1466 ms (-28%) | 71.6 kB vs 100.4 kB (-29%) | 1.72 vs 1.84 MB |
| 4 | vitral 1747 ms, MF 2397 ms (-27%) | 211.2 kB vs 308.6 kB (-32%) | 2.72 vs 3.13 MB |
| 8 | vitral 2818 ms, MF 3783 ms (-26%) | 409.3 kB vs 597.9 kB (-32%) | 3.99 vs 4.91 MB |

Where the difference comes from, looking at the requests:

- In MF, each `remoteEntry.js` brings its own runtime (about 17 kB with brotli per remote). The host brings another 19 kB.
- In MF with `shared`, the remote only asks for React after loading the runtime and going through the `loadShare` and `prebuild` modules: a chain of serial requests before mounting. With 150 ms of RTT, that weighs more than the bytes saved. With N=1, `shared` makes MF 1139 ms slower than without `shared`.
- In vitral with dedupe, React downloads once (about 63 kB). From N=4 to N=8, the 4 extra remotes cost 21.6 kB together.

## Return visit with maxStale

With `configure({ maxStale: 300 })`, the host uses the `vitral.json` saved on the previous visit and doesn't wait for revalidation (see [Loading](./carregamento#return-visit-without-waiting-for-the-manifest)). The cold visit doesn't change.

| N | With dedupe | With dedupe and `maxStale` | Difference |
| --: | --: | --: | --: |
| 1 | 402 ms | 253 ms | -37% |
| 4 | 450 ms | 298 ms | -34% |
| 8 | 531 ms | 348 ms | -34% |

## With a 4x slower CPU

Same network, `Emulation.setCPUThrottlingRate` 4x, 7 runs (`bench/publico/resultado-cpu4.json`). Bytes and requests don't change.

| Scenario | N | Cold (ms) | Warm (ms) |
| --- | --: | --: | --: |
| vitral, no dedupe | 1 | 1220 | 583 |
| vitral, with dedupe | 1 | 1272 | 604 |
| MF, no shared | 1 | 1632 | 544 |
| MF, shared singleton | 1 | 2854 | 638 |
| vitral, no dedupe | 4 | 2038 | 837 |
| vitral, with dedupe | 4 | 1618 | 778 |
| MF, no shared | 4 | 2698 | 896 |
| MF, shared singleton | 4 | 3829 | 943 |
| vitral, no dedupe | 8 | 3210 | 1301 |
| vitral, with dedupe | 8 | 2158 | 1009 |
| MF, no shared | 8 | 4039 | 1399 |
| MF, shared singleton | 8 | 4675 | 1597 |

With dedupe, vitral opens in less than half the time of MF with `shared` at every N. With N=1, on the warm visit, MF without `shared` (544 ms) is ahead of vitral (583 and 604 ms).

## Where vitral loses

- **Requests with N=1:** MF without `shared` makes 7 requests; vitral makes 14 without dedupe and 19 with dedupe.
- **Dedupe with a single remote:** with N=1, dedupe makes vitral 51 ms slower (1104 vs 1053 ms) and 4.2 kB heavier. It only pays off from 2 remotes of the same framework.
- **Requests with dedupe:** the split build produces many small files. With N=8, that's 60 requests, against 42 for MF without `shared` (but 85 for MF with `shared`).
- **Warm visit with N=1:** a tie without throttling (392 ms for both without dedupe and without `shared`). With 4x CPU, MF without `shared` is ahead (544 vs 583 ms).
- **Host alone:** vitral's makes 6 requests against MF's 2, even though it downloads less.

## Method

| Item | How |
| --- | --- |
| Remotes | 3 React for each Vue. N=1: 1 React. N=4: 3 React + 1 Vue. N=8: 6 React + 2 Vue |
| Code | The same `Cartao.jsx` and `Cartao.vue` in both. Only the entry changes: vitral's plugin wraps the `export default`; in MF, the remote exposes `./Cartao` with a `mount` function |
| Build | Vite 8 in both. Each remote is a separate build, with its own name. MF: `@module-federation/vite`, `remoteEntry.js` as an ES module, no manifest and no `dts` |
| vitral host | `configure` + `createSlot`, bundled by Vite |
| MF host | `init` + `loadRemote` from `@module-federation/runtime`, bundled by Vite, no plugin |
| Server | Node, localhost. Brotli level 11. Hashed file: `max-age=31536000, immutable`. `vitral.json`, `remoteEntry.js` and HTML: `no-cache` with ETag |
| Network | CDP `Network.emulateNetworkConditions`: 150 ms RTT, 1.6 Mbps download, 750 kbps upload |
| Cold | New browser context, empty cache |
| Warm | Second visit in the same context, with HTTP cache |
| Ready | `performance.now()` when the N `.cartao` elements are in the DOM (`MutationObserver`, the same code in both hosts) |
| Bytes | Sum of CDP `encodedDataLength`: brotli body plus headers |
| Requests | Requests that went to the network (those served from memory or disk cache don't count; 304 counts) |
| Memory | `Runtime.getHeapUsage().usedSize` after `HeapProfiler.collectGarbage`, on the cold visit |
| Runs | One warm-up visit not counted (the server compresses on the first time), then 7. Median |

## Versions and machine

| | |
| --- | --- |
| vitral | 0.11.0 with the 0.11.1 changes (commit 038dcf4), installed from the package tarball |
| @module-federation/vite | 1.23.9 |
| @module-federation/runtime | 2.9.3 |
| vite | 8.3.5 |
| @vitejs/plugin-react / plugin-vue | 6.2.1 / 6.0.10 |
| react, react-dom | 19.3.1 |
| vue | 3.5.44 |
| Chromium (Playwright 1.56.1) | 153.0.8010.12, headless |
| Node | 22.22.0 |
| Machine | Intel Xeon 2.10 GHz, 4 cores, 16 GB, Linux 6.18 |
| Date | 2026-11-04 |

## Limits

- One machine, one browser, a localhost server with an emulated network. Not a real network.
- The component is small. With bigger remotes, the runtime's weight counts less and the app code's counts more.
- MF was measured with the default `@module-federation/vite` setup. Webpack and Rspack with a runtime shared between remotes were not measured.
- No `mf-manifest.json` in MF. With a manifest, each remote makes one more request, like `vitral.json`.
- No CSS, no SSR, no navigation between routes.
- No CPU throttling in the main table. The 4x CPU table has no bytes or heap, which don't change.

## Reproduce

```bash
pnpm install
pnpm bench:publico
```

The script installs the pinned versions in a work folder (`bench/node_modules/.cache/publico`), without touching the lockfile. It builds hosts and remotes, measures and writes `bench/publico/resultado.json`. At the end, it prints the table above.

```bash
node bench/publico/run.mjs --n 4 --runs 3 --only vitral-dedupe,mf-shared
node bench/publico/run.mjs --cpu 4                  # 4x slower CPU
node bench/publico/run.mjs --sem-build --servir     # server only, port 4301
CHROMIUM_PATH=/path/chrome node bench/publico/run.mjs   # another Chromium (works for zonas.mjs too)
```

With `--servir`, open `http://127.0.0.1:4301/host-vitral/?remotes=vitral-dedupe&n=4` or `http://127.0.0.1:4301/host-mf/?remotes=mf-shared&n=4`.

This benchmark doesn't run in CI. The CI bench (`bench/run.mjs`) keeps measuring only vitral against `main`.

## New scenarios

Compression dictionaries don't have a scenario yet. Predictive prefetch is measured in the comparison with [Multi-Zones](#against-next-js-multi-zones). A new scenario goes in as one item in `bench/publico/cenarios.mjs`, with no change to `run.mjs`:

```js
{
  id: 'vitral-dict',
  rotulo: 'vitral, dedupe e dicionário',          // label
  host: 'vitral',
  ferramenta: 'vitral',                           // tool
  compartilha: true,                              // shares the framework
  build: (ferramenta, opcoes) => opcoes,          // remote plugin options
  servidor: (req, arquivo) => ({ headers: {} }),  // response headers or body
  antes: async (page, url) => {},                 // before each measured visit
  query: {},                                      // extra parameters in the host URL
}
```

## Against Next.js Multi-Zones

Multi-Zones splits the app by route: each team has a Next app (a zone) with some URLs, and switching zones reloads the page. The fair scenario is the same app split into two areas, A and B, one per team, opening A and going to B. Every number comes from `bench/publico/zonas.mjs`.

### Results

Median of 7 runs. "Slow 4G" network (150 ms RTT, 1.6 Mbps). HTTP/2. No CPU throttling. kB = 1024 bytes of body, with brotli.

| Scenario | Open A, interactive (ms) | Open A, first paint (ms) | Open A (kB) | Switch A → B (ms) | Switch (kB) | Downloaded A + B (kB) |
| --- | --: | --: | --: | --: | --: | --: |
| vitral, no dedupe | 1093 | 1112 | 71.4 | 627 | 58.0 | 129.4 |
| vitral, with dedupe | 1130 | 1148 | 74.3 | 364 | 3.9 | 78.2 |
| vitral, dedupe and prefetch | 1195 | 1216 | 80.7 | 186 | 0 | 80.7 |
| vitral, gateway with SSR | 703 | 196 | 76.4 | 369 | 3.8 | 80.2 |
| vitral, gateway and prefetch | 705 | 196 | 79.6 | 187 | 0.7 | 83.4 |
| Multi-Zones | 960 | 200 | 114.3 | 998 | 114.3 | 228.5 |
| Multi-Zones, prefetch | 966 | 196 | 115.8 | 839 | 112.8 | 228.6 |

The minimum and maximum of each cell are in `bench/publico/resultado-zonas.json`.

### What the numbers say

Best setup of each (vitral with gateway and prefetch, Multi-Zones with prefetch):

| | vitral | Multi-Zones | Difference |
| --- | --: | --: | --- |
| Open A, interactive | 705 ms | 966 ms | 27% faster |
| Open A, first paint | 196 ms | 196 ms | Tie |
| Switch A → B | 187 ms | 839 ms | 4.5 times faster |
| Downloaded in A + B | 83.4 kB | 228.6 kB | 64% less |

Where the difference comes from:

- **Switching areas:** in Multi-Zones, going to another zone reloads the page and downloads React and Next again (113 kB), even with identical files, because each zone serves its own under another path (`/a/_next/…`, `/b/_next/…`). In vitral, the app shell stays, React stays (dedupe) and only B's remote comes (4 kB). With prefetch, not even that: B is already downloaded.
- **First visit:** without the gateway, vitral loses (1130 vs 960 ms). The app shell HTML arrives empty, and the host discovers one file after another: the host JS, `vitral.json`, the SRI and dedupe code and, last, React. With the gateway (`routes`), the page already goes out with the route's HTML, the manifest and the `Link` (Early Hints) of every file, React included. The browser downloads everything in parallel and the outlet only hydrates. See [Routes with SSR](./ssr#routes-with-ssr).
- **Bytes:** Next sends its runtime (router, RSC) on top of React. vitral's host is the app shell and the library.

### With a 4x slower CPU

Best setup of each, same network, `Emulation.setCPUThrottlingRate` 4x, 7 runs (`bench/publico/resultado-zonas-cpu4.json`). Bytes don't change.

| | vitral | Multi-Zones | Difference |
| --- | --: | --: | --- |
| Open A, interactive | 859 ms | 1259 ms | 32% faster |
| Open A, first paint | 244 ms | 240 ms | Tie |
| Switch A → B | 232 ms | 1140 ms | 4.9 times faster |

With a slow CPU, the difference grows: Next runs its runtime again on every zone switch.

### Where vitral loses

- **Without the gateway, first visit:** 1130 ms vs 960 ms, and the first paint only comes with the JS (1148 vs 200 ms). Whoever can't put a server in front of the app shell pays that cost on the first visit.
- **Dedupe with a single area:** without dedupe, the first visit is 37 ms faster (1093 vs 1130 ms), but the switch downloads React again (58 kB). Dedupe pays off from the second area visited.
- **Chromium prerender:** with Speculation Rules `prerender`, zone B could open ready. Not measured: with DevTools on (Playwright, CDP), Chromium turns prerender off (`PrerenderingDisabledByDevTools`). Only `prefetch` was included. Prerender only exists in Chromium and runs B's whole page in the background.

### Method

| Item | How |
| --- | --- |
| App | Two areas, A and B. Each shows the same `Cartao.jsx` as the MF benchmark, with a button |
| Multi-Zones | Two Next 16 apps (App Router, Turbopack), each with its own `basePath` (`/a`, `/b`) and `output: 'export'`: the HTML comes ready from the build, Next's best case for first paint. Link between zones with `<a>`, as the docs say |
| Rewrites | The server sends `/a/*` and `/b/*` to each zone, without going through a third app |
| Multi-Zones prefetch | `<script type="speculationrules">` with `prefetch` of `/b/` and `eagerness: "immediate"`, to finish before the click |
| vitral | App shell with `routes({ '/v/a': 'a', '/v/b': 'b' })` and `<vitral-outlet>`. Two React remotes built with the plugin, with and without `dedupe: ['react']` |
| Gateway | `gateway({ routes })` from `vitral/edge` in front of the app shell, with `render` from `reactRender`. Brotli 11 compression on output |
| vitral prefetch | `vitral/prefetch`, trained with A → B three times before, and B's prefetch finished in A |
| Server | Node, HTTP/2 with TLS (local certificate accepted by its key, so the HTTP cache works). Brotli 11. Hashed file: `immutable`; HTML and `vitral.json`: `no-cache` |
| Open A | New context, empty cache |
| Interactive | Next: `useEffect` after hydration. vitral: the outlet's `vitral-ready`. In both, the button already responds |
| First paint | `first-contentful-paint` |
| Switch A → B | From the click (or `navigate`) until B is interactive, with the cache the visit to A left. Before it, 500 ms of reading in A (5 s with Speculation Rules) |
| Bytes | Response bodies, counted on the server. CDP doesn't give the size of files that arrive through Early Hints |
| Runs | One warm-up not counted, then 7. Median |

Versions: vitral 0.11.0 with the 0.11.1 changes (commit 038dcf4), Next 16.4.5, React 19.3.1, Vite 8.3.5, Chromium 153.0.8010.12 (Playwright 1.56.1, headless), Node 22.22.0, on the same machine as the MF table. Date: 2026-11-04.

### Limits

- One machine, one browser, a localhost server with an emulated network.
- Zones with static export. With per-request SSR, Next also spends render time on the server for each page.
- Two areas and a small component. With bigger areas, each area's code weighs more than the runtime.
- No CPU throttling in the main table. With 4x CPU, only the best setup of each.

### Reproduce

```bash
pnpm install
pnpm bench:zonas
node bench/publico/zonas.mjs --runs 3 --only vitral-gateway-prefetch,zonas-prefetch
node bench/publico/zonas.mjs --cpu 4                    # 4x slower CPU
node bench/publico/zonas.mjs --sem-build --servir       # static on 4302, gateway on 4303
```

To replace the zones with remotes, see [Migrate from Next.js Multi-Zones](/en/migracao/multi-zones).
