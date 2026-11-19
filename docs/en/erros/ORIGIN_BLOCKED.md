# ORIGIN_BLOCKED

The remote's URL (or the `entry` in `vitral.json`) is on an origin the host doesn't allow.

## Rule

- Without `allowedOrigins`, the page's origin and the origins of the URLs registered in `configure({ remotes })` are allowed.
- With `allowedOrigins`, only the origins in the list. `'*'` allows all of them.
- The manifest's `entry` is checked too. A `vitral.json` on `cdn.example.com` can't point the JS to another origin.

## How to fix

Add the origin (protocol + domain + port, no path):

```ts
configure({
  allowedOrigins: ['https://cdn.example.com', 'https://static.partner.com'],
})
```
