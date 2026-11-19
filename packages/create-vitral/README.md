<p align="center">
  <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/banner-en.png" width="640" alt="vitral. Made of parts. Seen as a whole.">
</p>

# create-vitral

Creates a [vitral](https://joaogabriel15.github.io/vitral/en/) host or remote, ready to run. vitral puts micro-frontends from any framework on one page, with no build config on the host.

```bash
npm create vitral@latest
```

With no options, the command asks what to create. With options:

```bash
npm create vitral@latest cart -- --remote --framework react
npm create vitral@latest shop -- --host --framework vue --src https://cdn.example.com/cart/vitral.json
```

| Option | Values |
| --- | --- |
| `--host`, `--remote` | What to create |
| `--framework`, `-f` | Hosts: react, next, vue, nuxt, angular, sveltekit, solid, preact, lit, vanilla. Remotes: react, vue, svelte, solid, preact, angular, lit, vanilla |
| `--src` | URL of the `vitral.json` the host loads |

Next, follow [Set up host and remote](https://joaogabriel15.github.io/vitral/en/aprender/configurar).

[Português](https://joaogabriel15.github.io/vitral/aprender/configurar) · MIT license · Made by [Pacheco Codes](https://pacheco.dev.br/)
