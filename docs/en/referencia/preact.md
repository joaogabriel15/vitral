# vitral/preact

Host and remote in Preact 10 or newer.

```ts
import { Remote, preactRemote, useShared } from 'vitral/preact'
```

## &lt;Remote&gt;

```jsx
<Remote
  name="cart"
  props={{ userId: 42 }}
  fallback={<p>Loading…</p>}
  error={(error, retry) => <button onClick={retry}>Try again</button>}
/>
```

The props are the same as [React's `<Remote>`](/en/referencia/react/remote#props), without `onError` and `className`. Extra attributes go to the element.

## preactRemote

```ts
preactRemote<P>(Component: ComponentType): RemoteModule<P>
```

```jsx
import { preactRemote } from 'vitral/preact'

export default preactRemote(Cart)
```

## useShared

```ts
useShared<T, S>(key: string, select?: (value: T | undefined) => S): S
```

Same as [React's `useShared`](/en/referencia/react/hooks#useshared).
