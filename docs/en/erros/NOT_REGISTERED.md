# NOT_REGISTERED

The host asked for a remote by name, but that name isn't registered.

## Causes

- The name in `<vitral-remote name="...">`, `<Remote name="...">` or `mountRemote(el, '...')` differs from the name in `configure({ remotes })`.
- `configure()` hadn't run yet when the remote was mounted.
- `register(name, {})` was called without `url` or `module`.

## How to fix

Register the remote before mounting:

```ts
configure({
  remotes: {
    cart: 'https://cdn.example.com/cart/vitral.json',
  },
})
```

With `remotes: 'https://.../remotes.json'`, check that the file has a key with that name.
