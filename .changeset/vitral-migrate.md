---
'vitral': minor
---

`npx vitral migrate` converte um app do single-spa ou um remote do Module Federation num remote vitral, sem mexer no build atual. Gera o embrulho do app (ou um arquivo por componente de `exposes`), um `vite.vitral.config.mjs` e o script `build:vitral`, mostra o diff de cada arquivo e lista o que fazer à mão. Com `--dry-run`, não escreve nada.

Duas entradas novas, fora do host mínimo:

- `vitral/single-spa`: `singleSpaRemote(lifecycles)` monta um app do single-spa (`bootstrap`, `mount`, `unmount`, `update`) pelo contrato `mount(el, props, ctx)`.
- `vitral/federation`: `federationRemote(url, options)` deixa o host vitral montar um remote do Module Federation a partir do `mf-manifest.json` (ou do `remoteEntry.js`), com `adapt` para embrulhar componentes e `shared` para oferecer as dependências do host. Serve para migrar um remote por vez.
