# register

Registers a remote after `configure`, or changes a remote's URL.

```ts
register(name: string, entry: string | RemoteEntry): void
registerSrc(src: string, name?: string): string
```

## Usage

```ts
import { register } from 'vitral'

register('cart', 'https://cdn.example.com/cart-v2/vitral.json')
register('menu', { module: () => import('./menu') })
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `name` | Name used in `<Remote name>` |
| `entry` | URL of `vitral.json` or of the JS, or an [entry](./configure#remote-entry) |
| `src` (`registerSrc`) | URL to register |

## Returns

`register` returns nothing. `registerSrc` returns the registered name. It's what the components do with the `src` prop.

## Notes

- The URL's origin joins the allowed origins list, unless `allowedOrigins` was set.
- Mounts already done don't change. Use [`refresh`](./updates) to swap.
