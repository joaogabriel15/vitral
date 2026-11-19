# vitral/testing

Fake remotes to test the host without a network, a harness to test the remote, and contracts between the two.

```ts
mockRemote<P>(name: string, render?: (el, props, ctx) => void): MockRemote<P>
failingRemote(name: string, message?: string): void
resetVitral(): void
harness<P>(mod: RemoteModule<P>, options: HarnessOptions<P>): Promise<Harness<P>>
record(options?: { host?: string; max?: number }): Recorder
verify(contract: Contract, mod: RemoteModule, options?: { sources?: string[]; wait?: number }): Promise<VerifyResult>
```

## Usage

```ts
import { mockRemote, failingRemote, resetVitral } from 'vitral/testing'

afterEach(() => resetVitral())

test('passes the items', async () => {
  const cart = mockRemote('cart', (el, props) => (el.textContent = `items: ${props.items}`))
  render(<App />)
  await screen.findByText('items: 2')
  expect(cart.lastProps).toEqual({ items: 2 })
})
```

## Functions

| Function | What it does |
| --- | --- |
| `mockRemote(name, render?)` | Registers a local remote. `render` runs on mount and on each update |
| `failingRemote(name, message?)` | Registers a remote that fails to mount |
| `resetVitral()` | Clears the library's state between tests |
| `harness(mod, { props })` | Mounts a remote with a simulated `ctx`. See [Contracts](/en/aprender/contratos#_1-test-the-remote-alone) |
| `record({ host })` | Records the consumer contract in the host: `contracts()`, `save(folder)` and `stop()` |
| `verify(contract, mod)` | Replays a contract. Returns `{ cases, failures, warnings }`. It's what `vitral test --contract` runs |
| `CONTRACT_SCHEMA` | URL of the contract's JSON Schema |

## What mockRemote returns

| Field | What it is |
| --- | --- |
| `mounts` | How many times it mounted |
| `lastProps` | Most recent props |
| `ctx` | Context of the last mount |
| `mounted` | Whether it's mounted now |
