# CONTRACT_MISMATCH

The host declared `contract` and the remote's `vitral.json` doesn't meet it. The remote's JS isn't downloaded or run, and `mount()` isn't called.

## Causes

- The remote's contract version is outside the host's range. E.g. the host accepts `^2` and the remote published `contract: { version: '3.0.0' }`.
- The host offers a dependency with `dedupe` at a version outside the range the remote expects. E.g. the remote was built with `dedupe: ['react']` and React 19 (`^19.0.0`), and the host offers React 18.3.1.

The message brings the remote's name, the expected range and the version found (library messages are in Portuguese):

```
[vitral] carrinho: o host aceita contrato ^2, o remote publica 3.0.0
[vitral] carrinho: o remote espera react ^19.0.0, o host oferece 18.3.1
```

## What isn't checked

- A remote without `contract` in `vitral.json` (an old manifest or a direct JS URL).
- A host without `contract` in `configure` or in the remote's entry.
- A dependency the host doesn't offer: the remote uses its own copy.

## How to fix

- Publish the remote with a contract version the host accepts, or update the range in the host (`contract: '^3'`) after adapting the host.
- For dependencies, align the host's and the remote's versions, or remove the dependency from the remote's `dedupe`.

See [Contract between host and remote](/en/aprender/deploy#contract-between-host-and-remote).
