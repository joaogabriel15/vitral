# vitral/prefetch

Prefetches the remote of the likely next route, based on the user's own navigations.

```ts
prefetch(options?: PrefetchOptions): () => void
warm(name: string): Promise<boolean>
```

## Usage

```ts
import { configure } from 'vitral'
import { routes } from 'vitral/routes'
import { prefetch } from 'vitral/prefetch'

configure({ remotes: '/remotes.json' })
routes({ '/': 'home', '/search': 'search', '/checkout/*': 'checkout' })
prefetch()
```

Works with `<vitral-outlet>`, `<Remote>`, `createSlot` and `mountRemote`: what counts is which remote mounted on which route.

## How it works

1. On each navigation, it counts the transition to the current route from each context: the previous route, the last two and the last three (Markov chain of orders 1 to 3).
2. On each mount, it records the remote on the current route and how many bytes it downloaded.
3. When idle, it predicts the next route from the longest context that has at least `min` transitions and a confidence of at least `threshold`. Without one, it uses a shorter context (Selective Markov Models, Deshpande and Karypis, 2004).
4. It downloads the predicted route's remotes only if the probability times the time saved beats the cost of the bytes: `p × (2 × RTT + bytes ÷ bandwidth) > byteCost × bytes`, with the RTT and bandwidth the browser estimates right now. On a slow network, a less certain prediction is already worth it; on a fast one, only a very certain one.
5. On a `pointerdown` on a link to another route, it downloads that route's remotes right away, about 100 ms before the click.

Prefetching downloads `vitral.json` and the remote's files, without running anything:

| Remote | How it downloads |
| --- | --- |
| With integrity, browser with import maps that support `integrity` | Import map with the hashes and `fetch` (HTTP cache) |
| With integrity, browser that checks the `modulepreload` hash | `<link rel="modulepreload" integrity>` |
| With integrity, in the others (WebKit with CSP, for example) | `fetch` (HTTP cache); the hash is checked at mount |
| Without integrity | `<link rel="modulepreload">` |

It's the same SRI path the mount uses (see [Security](/en/aprender/seguranca)). WebKit ignores the `integrity` of `modulepreload`, so there it uses only `fetch`.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `threshold` | `0.1` | Minimum probability of the next route, before the cost check |
| `min` | `2` | Transitions counted in a context before using it |
| `prior` | | Population transitions, for the first visit: the object or the JSON URL (see below) |
| `alpha` | `5` | Weight of the population, in transitions: user counts + `alpha` × population |
| `byteCost` | `0.0005` | Cost of each byte downloaded for nothing, in ms of waiting (100 kB is worth 50 ms). `0` turns off the check |
| `speculate` | `false` | Speculation Rules (Chrome 121+) for the predicted route that has no remote: the browser downloads its document. Only with the default `key` |
| `storage` | `localStorage` | Where to keep the counts. `null` keeps them only in memory |
| `key` | `url.pathname` | The route key |
| `onPrefetch` | | `(remotes, route) => void`, after downloading |

Routes with parameters become a single key with `key`:

```ts
import { matchRoute } from 'vitral/routes'

prefetch({ key: (url) => matchRoute(url.pathname)?.pattern ?? url.pathname })
```

## Population on the first visit

Without counts, a new user has no prediction. `prior` mixes the transitions of many people with theirs:

```ts
prefetch({ prior: '/vitral-prior.json' })
```

The JSON comes from aggregated sessions (for example, the analytics export), one per line, each an array of routes:

```bash
vitral prior sessions.jsonl --out public/vitral-prior.json
```

Transitions seen fewer than 5 times (`--min-count`) and routes with fewer than 20 transitions (`--min-row`) are left out, so the public file doesn't show anyone's path. The `r` field (route → remotes) is optional: without it, the first visit predicts the route but only downloads the remotes the user already mounted on it.

## Returns

`prefetch` returns the function that stops observing. The counts stay stored.

`warm(name)` prefetches a remote right away, the same way. Returns `false` if it couldn't (no error in the console).

## Notes

- Doesn't download anything with the `'lazy'` policy (data saver or 2G). See [Slow network and weak devices](/en/aprender/carregamento#slow-network-and-weak-devices).
- Each remote is prefetched once per page. A remote already mounted on the page doesn't download again.
- The counts are in `localStorage['vitral:prefetch']`, with at most 150 contexts, 10 destinations per context and 8 remotes per route.
- A remote with `isolate: 'iframe'` isn't prefetched.
- The remote's `dedupe` copies aren't prefetched: only the mount knows whether someone on the page already offers the dependency.
- Detects navigation through the Navigation API where it exists; in other browsers, through `popstate` and the mounts.
