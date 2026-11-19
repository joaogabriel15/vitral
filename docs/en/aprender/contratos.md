# Contracts between host and remote

The host records what it passes to each remote. The remote replays that recording in its own CI. That way the remote team finds the break before the deploy, not through the host in production.

```
host (tests)                          remote (CI)
record() ─► cart.contract.json ─► npx vitral test --contract
```

## When to use it

When host and remote live in different repositories or teams and a remote deploy can break the host.

## 1. Test the remote alone

`harness` mounts the remote with a simulated `ctx`, with no host:

```ts
// @vitest-environment happy-dom
import { harness } from 'vitral/testing'
import remote from '../src/remote'

test('emits the purchase', async () => {
  const h = await harness(remote, { props: { items: 2 }, shared: { user: { id: 1 } } })
  expect(h.el.textContent).toContain('2 items')
  h.emit('theme', 'dark')                          // as if it were the host
  h.el.querySelector('button')!.click()
  expect(h.events).toContainEqual({ type: 'cart:purchase', payload: { total: 10 } })
  h.update({ items: 3 })
  h.unmount()
})
```

| Option | What it does |
| --- | --- |
| `props` | Mount props |
| `name` | `ctx.name`. Default `'remote'` |
| `shadow` | Mounts inside a shadow root |
| `shared` | Initial values of `ctx.shared` |
| `last` | Initial values of `ctx.events.last` |
| `ctx` | Fields that replace those of the simulated `ctx` |
| `target` | Where to mount. Default: a new `<div>` in `body` |

The result has `el`, `ctx`, `events` (what the remote emitted), `errors` (`reportError` and handlers that threw), `navigations`, `listens()`, `emit()`, `update()`, `activate()`, `deactivate()` and `unmount()`.

## 2. Record in the host

In the host tests (unit or e2e), call `record()` before mounting the remotes and subscribing to events:

```ts
import { record } from 'vitral/testing'

const rec = record({ host: 'shop' })
// ... the tests mount <Remote name="cart" props={{ items: 2 }} /> ...
afterAll(() => rec.save('contracts'))       // contracts/cart.contract.json
```

For each remote, the contract stores:

| Field | What it is |
| --- | --- |
| `props` and `updates` | What the host passed on mount and on each update |
| `inputs` | Events the host emitted that the remote listened to |
| `shared` and `last` | What the remote read from `ctx.shared` and `ctx.events.last` |
| `emits` | Remote events the host listens to, and when they fired (`mount`, `update`, `input` or `later`) |
| `listens` | Events the remote subscribed to |

Functions in props become `{ "$fn": true }`. Equal cases are stored once (up to 50 per remote; change it with `max`). Schema: [`vitral-contract.json`](/schema/vitral-contract.json).

In a browser e2e, `save` doesn't exist (there's no disk). Expose the contracts and write them from Playwright:

```ts
// in the host, only in tests
import { record } from 'vitral/testing'
const rec = record({ host: 'shop' })
;(window as any).__contracts = () => rec.contracts()
```

```ts
// in the Playwright test
const contracts = await page.evaluate(() => (window as any).__contracts())
for (const [name, c] of Object.entries(contracts)) writeFileSync(`contracts/${name}.contract.json`, JSON.stringify(c, null, 2))
```

Publish the `contracts/` folder where the remote's CI can read it (an artifact, a package or a commit in the remote's repository).

## 3. Replay in the remote's CI

```yaml
- run: npm run build
- run: npx vitral test --contract contracts/ --since https://cdn.example.com/cart/vitral.json
```

`--contract` mounts `dist/` in happy-dom, with no browser, with each recorded case. It fails when:

- mount, an update or unmount throws, or the remote calls `ctx.reportError`;
- an event the host listens to, which fired on mount, on an update or in response to a host event, no longer fires;
- an event the host listens to, which fired later (on a click), no longer appears in the build's code;
- the recorded props don't match the `Props` in the local `vitral.d.ts` (a new required prop, a changed type).

It warns, without failing, when the host emits an event the remote no longer listens to, or passes a prop the remote doesn't declare.

`--since` compares the `Props` of the published `vitral.d.ts` with the build's:

```
✗ breaking: new required prop: currency: string
✗ breaking: removed prop: coupon: string (a host that still passes coupon won't compile)
✓ compatible: theme type accepts more values: "light" → "light" | "dark"
```

Breaking: new required prop, optional prop that became required, removed prop, and a type that no longer accepts the old value.

## Limits

- The remote must use `ctx.events` and `ctx.shared`. A remote that imports `events` from `'vitral'` directly has its events counted as the host's.
- Remotes in `isolate: 'iframe'` and parts (`cart/Mini`) are not recorded.
- The replay runs in happy-dom: what depends on layout or on the network during mount needs a test double in the remote itself.

[Full CLI options](/en/referencia/cli#vitral-test) · [vitral/testing](/en/referencia/testing)
