<script setup>
import { withBase } from 'vitepress'
</script>

# Props and events

Props carry data from the host to a remote. Events carry messages between any parts of the page.

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/comunicacao-en.png')" alt="Three remotes in React, Vue and Angular. The cart emits an event, the search receives it on the same bus, and the account reads the user the host created with provide.">
  <img class="so-escuro" :src="withBase('/marca/comunicacao-escuro-en.png')" alt="">
</picture>

## When to use each

| Use | For | Example |
| --- | --- | --- |
| props | Data for one remote instance | `userId`, `productId`, callbacks |
| `events` | One-off messages between host and remotes | "item added", "user logged out" |
| `navigate` | Changing page from inside a remote | `/orders/42` |
| [Shared context](./contexto) | State that many parts read | logged-in user, theme |

## Props

```jsx
<Remote name="cart" props={{ userId, onCheckout: (order) => goTo(order) }} />
```

The remote receives them in `mount` and then in `update`. Functions work too. Changing props does not remount the remote.

On `<vitral-remote>`, the `props` attribute only accepts JSON. For functions, use the `el.props` property.

## Events

```ts
import { events } from 'vitral'

events.emit('cart:total', 120)
const stop = events.on('cart:total', (total) => console.log(total))
events.last('cart:total') // 120
stop()
```

Inside the remote, use `ctx.events`. What the remote subscribes to through it is cancelled on unmount:

```ts
mount(el, props, ctx) {
  ctx.events.on('auth:user', (u) => (el.dataset.user = u.name))
  return { unmount() {} }
}
```

- The host and every remote use the same bus.
- `last(type)` returns the latest value, even for subscribers that came after the `emit`.
- A handler that throws doesn't stop the others.
- Use a prefix in the name (`cart:`) to know who emits it.

| Method | What it does |
| --- | --- |
| `emit(type, value)` | Sends the event |
| `on(type, fn)` | Subscribes. Returns the function that cancels |
| `last(type)` | Latest value emitted |

Hooks: `useEvent` and `useEventValue` in [React](/en/frameworks/react) and [Vue](/en/frameworks/vue).

For a separate bus of your own: `createEventBus()`.

## Navigation

```ts
import { navigate } from 'vitral'

navigate('/orders/42')
navigate('/login', { replace: true })
```

`navigate` updates the history and fires `popstate`. React Router, Vue Router, Next, Nuxt and the other routers read the new URL. A URL on another origin reloads the page. Inside the remote, `ctx.navigate` does the same.
