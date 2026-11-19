# INVALID_MODULE

The file downloaded, but it doesn't have the expected format.

## Causes

- The remote's JS doesn't export `mount()` (neither `export default { mount }` nor `export function mount`).
- A part without UI (`cart/api`) was used as a component. Use `loadModule('cart/api')`.
- `vitral.json` has no `entry` field.
- `vitral.json` or `remotes.json` isn't valid JSON. A common case: the server returned the fallback HTML page instead of the file.

## How to fix

In the remote, export with `defineRemote()` or with an adapter:

```ts
import { defineRemote } from 'vitral'

export default defineRemote({
  mount(el, props) {
    el.textContent = props.msg
    return { unmount: () => el.replaceChildren() }
  },
})
```

Open the manifest URL in the browser and check that it returns JSON.
