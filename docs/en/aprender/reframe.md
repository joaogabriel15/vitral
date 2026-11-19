# Reframe

The remote's JS runs in a hidden, same-origin iframe. The DOM lives in a shadow root on the page.

## When to use it

For a remote that pollutes `window` (globals, timers, forgotten listeners) and needs the page's normal layout, focus and events. For third-party code, use [Iframe](./iframe): reframe is not a security boundary.

| | `shadow` | `reframe` | `iframe` |
| --- | --- | --- | --- |
| Globals (`window.x`) | the page's | the iframe's | the iframe's |
| Forgotten timers and listeners | stay | go away on unmount | go away on unmount |
| DOM | shadow root on the page | shadow root on the page | inside the iframe |
| Layout, focus, popovers | normal | normal | stuck in the iframe |
| Props with functions | yes | yes | no (serializable data only) |
| Reads `parent.document`, cookies, storage | yes | yes | no |

## Code

```html
<vitral-remote name="legacy-panel" isolate="reframe"></vitral-remote>
```

```jsx
<Remote name="legacy-panel" isolate="reframe" props={{ onSave }} />
```

```ts
register('legacy-panel', { url: 'https://cdn.example.com/panel/vitral.json', isolate: 'reframe' })
await mountRemote(el, 'legacy-panel', props, { isolate: 'reframe' })
```

This mode's code only downloads on the first mount with `reframe`.

## What happens

Each mount creates a hidden iframe, and unmount removes the iframe together with the remote's timers and globals. CSS and DOM live in a shadow root on the page, as with `isolate="shadow"`. Inside the remote, `document` and `window` keep working: DOM queries go to the shadow root, and `resize`, `scroll`, `matchMedia` and the like are the page's.

## Routes

The iframe starts with the page's URL. Both histories stay in sync:

- The remote's `history.pushState`/`replaceState` change the page's URL and fire `popstate` on it (the same effect as `ctx.navigate`).
- Page navigation updates the iframe's URL and fires `popstate` in it.

`location.href = '…'` and `location.assign()` in the remote navigate the iframe itself and take the remote down. Use `history.pushState` or `ctx.navigate`.

## What is not isolated

- **Same origin.** The remote reaches `parent`, `top`, and the page's cookies, `localStorage`, `sessionStorage` and IndexedDB.
- **`instanceof` across realms.** Elements and events belong to the page; `Node`, `Element`, `Event`, `Array`, `Promise` belong to the iframe. `el instanceof Element` and `e instanceof MouseEvent` are `false`. `HTMLElement` is the exception (it is the page's). Use `nodeType`, `tagName`, `Array.isArray`.
- **`dedupe`** doesn't apply: the remote uses its own copy of the dependencies (the single file). A dependency from another realm would break `instanceof` and the framework's state.
- **`prefetch` and `preload()`** run the JS on the page. Don't use them with `reframe` remotes (the same goes for `iframe`).
- **`embed.js`** doesn't have this mode.
- **`devOverrides`** (`?vitral=`) doesn't swap `reframe` remotes.

## CSP

The page puts an inline script in the iframe. Without `'unsafe-inline'`, allow its hash, or put a `<script nonce>` on the page (vitral copies the nonce):

```
script-src 'sha256-zE2PiEdQK14jaNrBB8KHlUBNpc8NevOjcdUgA9xR0VQ=' blob:
```

`blob:` is needed when there is `integrity`. Without the script, mounting fails with `LOAD_FAILED`.
