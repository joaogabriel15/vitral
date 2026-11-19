# Testing

`vitral/testing` registers fake remotes to test the host without the network.

## When to use it

In unit tests of the host and of the remote, with happy-dom or jsdom.

## Host

```ts
import { mockRemote, failingRemote, resetVitral } from 'vitral/testing'
import { render, screen } from '@testing-library/react'

afterEach(() => resetVitral())

test('passes the items to the cart', async () => {
  const cart = mockRemote('cart', (el, props) => (el.textContent = `items: ${props.items}`))
  render(<App />)
  await screen.findByText('items: 2')
  expect(cart.lastProps).toEqual({ items: 2 })
  expect(cart.mounts).toBe(1)
})

test('shows the error', async () => {
  failingRemote('recommendations')
  render(<App />)
  await screen.findByText('Try again')
})
```

| Function | What it does |
| --- | --- |
| `mockRemote(name, render?)` | Registers a local remote. `render(el, props, ctx)` runs on mount and on each update |
| `failingRemote(name, message?)` | Registers a remote that fails to mount |
| `resetVitral()` | Clears the library's state between tests |

The object from `mockRemote` has `mounts`, `lastProps`, `ctx` and `mounted`.

## Remote

```ts
import { register, mountRemote } from 'vitral'
import remote from '../src/remote'

test('shows the name', async () => {
  register('cart', { module: remote })
  const el = document.createElement('div')
  const mounted = await mountRemote(el, 'cart', { name: 'Ana' })
  expect(el.textContent).toContain('Ana')
  mounted.update?.({ name: 'Bia' })
  mounted.unmount()
})
```

To mount the remote without a host, with a simulated `ctx`, use `harness`. For the host to record what it expects from the remote and the remote to check it in CI, see [Contracts between host and remote](/en/aprender/contratos).
