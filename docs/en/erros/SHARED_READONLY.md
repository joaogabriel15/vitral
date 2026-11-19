# SHARED_READONLY

Someone called `set` (or `update`) on a key created with `provide(key, value, { writable: false })` without being its owner. Only whoever called `provide` first changes that key.

In development, `set` throws this error. In production the write is ignored and a warning goes to the console.

## How to fix

Let the owner change the value. For controlled changes, the owner exposes actions in the value itself:

```ts
// owner (host)
const cart = provide('cart', createCart([]), { writable: false })

function createCart(items: Item[]) {
  return {
    items,
    add: (item: Item) => cart.set(createCart([...items, item])),
  }
}

// remote
shared('cart').get()?.add(item)
```

If anyone may change it, create the key without `writable: false`.
