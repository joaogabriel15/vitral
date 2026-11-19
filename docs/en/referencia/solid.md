# vitral/solid

Host and remote in Solid 1.8 or newer.

```ts
import { Remote, solidRemote, useShared } from 'vitral/solid'
```

## &lt;Remote&gt;

```jsx
<Remote
  name="cart"
  props={{ userId: userId() }}
  fallback={<p>Loading…</p>}
  error={(error, retry) => <button onClick={retry}>Try again</button>}
/>
```

The props are the same as [React's `<Remote>`](/en/referencia/react/remote#props), with `class` instead of `className` and without `onError`. On the server (SolidStart), it renders only the `fallback`.

## solidRemote

```ts
solidRemote<P>(Comp: Component): RemoteModule<P>
```

```jsx
function Cart(props) {
  return <button onClick={() => props.vitral.events.emit('cart:open')}>Cart for {props.userId}</button>
}

export default solidRemote(Cart)
```

The `ctx` comes in the `vitral` prop.

## useShared

```ts
useShared<T, S>(key: string, select?: (value: T | undefined) => S): Accessor<S>
```

```jsx
const name = useShared('user', (u) => u?.name)
return <p>{name()}</p>
```
