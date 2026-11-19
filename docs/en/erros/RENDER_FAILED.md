# RENDER_FAILED

The remote was already mounted and broke later (a render error or in a handler) and told the host with `ctx.reportError()`. The `reactRemote` and `vueRemote` adapters do this on their own.

## How to fix

The original error is in `error.cause`. In the host, handle the error in `onError`:

```ts
mountRemote(el, 'cart', props, {
  onError: (error) => console.error(error.cause),
})
```

Without `onError`, the error goes to `console.error`.
