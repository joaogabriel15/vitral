# RemoteError

Every library error is a `RemoteError`.

```ts
class RemoteError extends Error {
  code: RemoteErrorCode
  remote: string
  docs: string
  cause?: unknown
  entry?: string
  version?: string
  route?: string
}
```

## Usage

```jsx
<Remote name="cart" onError={(error) => log(error.code, error.remote)} />
```

## Fields

| Field | What it is |
| --- | --- |
| `code` | Error code |
| `remote` | Remote name |
| `docs` | Link to the code's page, with cause and fix |
| `cause` | Original error, when there is one |
| `entry` | URL of the remote's JS, or the registered URL if the error came before the manifest |
| `version` | `version` from `vitral.json` |
| `route` | `location.pathname` when the error happened |

To receive the errors of every remote, use `configure({ onError })`. See [Error handling](/en/aprender/erros#attribution-and-global-onerror).

## Codes

| Code | When |
| --- | --- |
| [`NOT_REGISTERED`](/en/erros/NOT_REGISTERED) | Name with no registered URL |
| [`NOT_EXPOSED`](/en/erros/NOT_EXPOSED) | Part not published in `exposes` |
| [`ORIGIN_BLOCKED`](/en/erros/ORIGIN_BLOCKED) | Origin outside `allowedOrigins` |
| [`TIMEOUT`](/en/erros/TIMEOUT) | Download went past the time limit |
| [`INTEGRITY`](/en/erros/INTEGRITY) | Hash doesn't match |
| [`INVALID_MODULE`](/en/erros/INVALID_MODULE) | Module without `mount` |
| [`LOAD_FAILED`](/en/erros/LOAD_FAILED) | Network failure |
| [`MOUNT_FAILED`](/en/erros/MOUNT_FAILED) | `mount` threw an error |
| [`RENDER_FAILED`](/en/erros/RENDER_FAILED) | Error after mounting |
| [`SHARED_READONLY`](/en/erros/SHARED_READONLY) | `set` on a read-only key |
| [`CONTRACT_MISMATCH`](/en/erros/CONTRACT_MISMATCH) | The remote's contract is outside the host's range |

`docs` links to the Portuguese error page; the English version lives at the same path under `/en/erros/`.

## Notes

::: warning Warning
With two copies of the library on the page, `instanceof RemoteError` can fail. Compare `error.name === 'RemoteError'`.
:::
