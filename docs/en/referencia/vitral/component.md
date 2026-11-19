# component

Creates a plain JS or TS remote from a function that returns HTML.

```ts
component<P, S>(options: RenderFn<P, S> | { state?, render, mounted? }): RemoteModule<P>
html`...`: Template
unsafeHTML(markup: string): Template
render(view: Template | string | Node, el: Element): void
```

## Usage

```ts
import { component, html } from 'vitral'

export default component({
  state: { count: 0 },
  render: (props, state) => html`
    <p>Hello, ${props.name}</p>
    <button onclick=${() => state.count++}>Clicks: ${state.count}</button>
  `,
})
```

The function alone works too:

```ts
export default component((props) => html`<p>Hello, ${props.name}</p>`)
```

## Parameters

| Option | What it is |
| --- | --- |
| `render(props, state, ctx)` | Returns the HTML |
| `state` | Local state, or a function that creates it. Changing a field renders again |
| `mounted(el, state, ctx)` | Runs after the first render. It can return a cleanup |

## Returns

A remote with `mount`.

## Notes

- Values in `html` are escaped. `unsafeHTML` inserts HTML without escaping.
- More examples in [Plain JS and TS](/en/frameworks/javascript).
