# vitral/vitals

LCP, CLS and INP of each remote, per route. FCP and TTFB of the page. No dependencies: it uses `PerformanceObserver`.

```ts
vitals(options: { onReport: (report: VitalReport) => void }): () => void
```

```ts
import { vitals } from 'vitral/vitals'

const stop = vitals({
  onReport: (r) => navigator.sendBeacon('/rum', JSON.stringify(r)),
})
```

Call it once, early, in the host. `stop()` reports what's left and turns off measuring.

## VitalReport

```ts
{
  name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
  remote?: string        // missing: host or page
  version?: string       // version of the remote's manifest
  route: string          // pathname of the navigation
  navigationId?: string  // only with Soft Navigations
  value: number          // ms; CLS has no unit
  rating: 'good' | 'needs-improvement' | 'poor'
}
```

Example:

```json
{ "name": "CLS", "remote": "cart", "version": "1.4.2", "route": "/shop", "value": 0.18, "rating": "needs-improvement" }
```

## Who owns each metric

The owner is the remote whose root element (`data-vitral-root`) contains the entry's element. Shadow DOM is crossed. With nested remotes, the innermost wins.

| Metric | Element | Value |
| --- | --- | --- |
| LCP | `element` of the navigation's largest paint | one per navigation, with the owner of the largest paint |
| CLS | the largest source (`sources`) of each shift | sum per session window (1 s gap, 5 s max), per owner |
| INP | the interaction's `target` | worst interaction per owner, ignoring one in every 50 |
| FCP, TTFB | - | the page's, without `remote` |

The source of a layout shift is the element that moved. A remote that grows and pushes the host causes a shift of the host, not of the remote.

Shifts up to 500 ms after a user input don't count (`hadRecentInput`).

## Routes and Soft Navigations

| Browser | Route | `navigationId` |
| --- | --- | --- |
| Chromium with Soft Navigations | URL of the `soft-navigation` entry | yes |
| Others | `location.pathname` at the time of the entry | no |

With Soft Navigations, the route's LCP is measured from the start of the soft navigation.

Each metric is reported when the route changes, when the tab is hidden and on `stop()`. It's only reported again if the value changed.

## Support

| Metric | Chromium | Firefox | Safari |
| --- | --- | --- | --- |
| LCP | yes | yes | depends on the version |
| CLS | yes | no | no |
| INP | yes | depends on the version | depends on the version |
| FCP, TTFB | yes | yes | yes |

What the browser doesn't measure isn't reported. Nothing breaks and nothing is reported with the wrong owner.

## OpenTelemetry

`otelVitals`, from `vitral/otel`, records each report in a `vitral.vitals.<lcp|cls|inp|fcp|ttfb>` histogram.

```ts
import { metrics } from '@opentelemetry/api'
import { otelVitals } from 'vitral/otel'
import { vitals } from 'vitral/vitals'

vitals({ onReport: otelVitals(metrics.getMeter('host')) })
```

Unit `ms` (`1` for CLS). Attributes: `vitral.remote`, `vitral.version`, `vitral.route`, `vitral.navigation_id` and `vitral.rating`. Missing ones are left out.

## Limits

- Remote with `isolate: 'iframe'`: the iframe's content doesn't reach the page's observer. Only the iframe itself is attributed.
- Without Soft Navigations, a shift that comes right after a `pushState` gets the new route.
- The sum of each owner's CLS isn't the page's CLS: session windows are separated per owner.
