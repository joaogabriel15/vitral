# defineRemote

Declares a hand-written remote, without a framework adapter. It only adds types.

```ts
defineRemote<P>(remote: RemoteModule<P>): RemoteModule<P>
```

## Usage

```ts
import { defineRemote } from 'vitral'

export default defineRemote<{ name: string }>({
  mount(el, props, ctx) {
    el.textContent = `Hello, ${props.name}`
    return {
      update(next) {
        el.textContent = `Hello, ${next.name}`
      },
      unmount() {
        el.textContent = ''
      },
    }
  },
})
```

## Parameters

`mount(el, props, ctx)` receives:

| Parameter | What it is |
| --- | --- |
| `el` | Element the remote draws in |
| `props` | Props passed by the host |
| `ctx` | The remote's context. See below |

`mount` returns `{ update?, unmount }`, or a Promise with that object.

## Returns

The same object it received.

## `ctx`

| Field | What it is |
| --- | --- |
| `name` | Name the host registered the remote with |
| `baseUrl` | Base URL the remote was loaded from. Use it for assets |
| `events` | The [event bus](./events). Subscriptions cancelled on unmount |
| `shared` | The same [`shared`](./shared). Subscriptions cancelled on unmount |
| `shadowRoot` | Shadow root with `isolate: 'shadow'`, otherwise `null` |
| `portalContainer` | Target for [portals](/en/aprender/estilos#portals-radix-headless-ui-mui). In Shadow DOM, an element inside the shadow root; otherwise, `document.body` |
| `customElements` | The remote's custom elements registry. In Shadow DOM, with browser support, a registry of its own. See [Custom elements per remote](/en/aprender/estilos#custom-elements-per-remote) |
| `navigate(url, { replace? })` | Same as [`navigate`](./navigate) |
| `reportError(error)` | Shows the error in the host |
| `onActivate(fn)`, `onDeactivate(fn)` | With keep-alive: return to and leaving the page |
| `mcp` | Only in an [MCP App](/en/aprender/mcp-app): the MCP host's `request`, `notify` and `hostContext()` |

## Notes

- Without `update`, the host remounts on every props change.
- `onActivate`, `onDeactivate`, `shared` and `customElements` may be missing in old hosts. Use `ctx.onActivate?.(fn)` and `ctx.customElements ?? customElements`.
