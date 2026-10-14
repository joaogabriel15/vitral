---
"vitral": minor
---

Host sem `configure()`:

- `src` no `<vitral-remote>` e em todos os componentes de host (`<Remote src>`, `<VitralRemote src>`, `use:remote={{ src }}`). O remote fica registrado com o nome do manifesto, que chega em `ctx.name`.
- A origem de um `src` passado a um componente entra na allowlist, mesmo com `allowedOrigins`. O `src` em atributo do `<vitral-remote>` continua passando pela allowlist.
- `registerSrc(src, name?)` para registrar uma URL e receber o nome.
- `vitral/auto`: importar define o `<vitral-remote>`. Serve para HTML sem build: `<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js">`.
- Sem os slots `fallback` e `error`, o `<vitral-remote>` mostra um carregando com `role="status"` e um erro com "Tentar de novo".
