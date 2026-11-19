# vitral/iframe

Turns on `isolate: 'iframe'`: the remote runs in an iframe with `sandbox`.

```ts
enableIframe(options?: IframeOptions): void
FRAME_SCRIPT: string
```

## Usage

```ts
import { enableIframe } from 'vitral/iframe'

enableIframe()
```

```jsx
<Remote name="partner-widget" isolate="iframe" />
```

## Parameters

| Option | Default | What it does |
| --- | --- | --- |
| `sandbox` | `'allow-scripts'` | Value of the `sandbox` attribute |
| `bridges` | `[]` | Extra bridges: `(port, { name }) => cleanup` |

## Returns

Nothing.

## Notes

::: warning Warning
With `allow-same-origin` and `allow-scripts` together, the iframe no longer isolates.
:::

- Only serializable data goes through. Functions in props don't.
- The shared context doesn't cross the iframe.
- `FRAME_SCRIPT` is the iframe's script. Use it to compute the CSP hash. See [Iframe](/en/aprender/iframe#csp).
