# vitral errors

Every library error is a `RemoteError` with `code`, `remote` (the remote's name) and `docs` (link to the code's page). The message also carries the link. Messages are in Portuguese; the code and this page tell you the cause and the fix.

```ts
createSlot(el, {
  name: 'cart',
  onStatus(status, error) {
    if (error) console.log(error.code, error.remote, error.docs)
  },
})
```

| Code | When it happens |
| --- | --- |
| [NOT_REGISTERED](NOT_REGISTERED.md) | The name wasn't registered in `configure({ remotes })` |
| [NOT_EXPOSED](NOT_EXPOSED.md) | The remote doesn't expose the requested part (`cart/MiniCart`) |
| [ORIGIN_BLOCKED](ORIGIN_BLOCKED.md) | The remote's URL is outside `allowedOrigins` |
| [TIMEOUT](TIMEOUT.md) | The remote didn't answer within `timeout` |
| [INTEGRITY](INTEGRITY.md) | The JS hash doesn't match `integrity` |
| [INVALID_MODULE](INVALID_MODULE.md) | The file doesn't export `mount()` (or the part is a module without UI) or the JSON is invalid |
| [LOAD_FAILED](LOAD_FAILED.md) | Network or HTTP error, or an error while running the JS |
| [MOUNT_FAILED](MOUNT_FAILED.md) | The remote's `mount()` threw an error |
| [RENDER_FAILED](RENDER_FAILED.md) | The remote broke after mounting |
| [SHARED_READONLY](SHARED_READONLY.md) | `set` on a key with `writable: false` by someone other than the owner |
| [CONTRACT_MISMATCH](CONTRACT_MISMATCH.md) | The remote's contract doesn't meet the host's `contract` |
