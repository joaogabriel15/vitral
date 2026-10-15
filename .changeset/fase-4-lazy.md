---
"vitral": minor
---

Carregamento sob demanda e keep-alive nos componentes de host (React, Vue, Preact, Solid, Svelte) e no `<vitral-remote>`: `loading="lazy|idle"`, `prefetch="hover|visible|idle"`, `priority="high"` (vira `fetchpriority`) e `keepAlive` (LRU, padrão 5; o remote sai da página sem desmontar e volta só com `update`). O remote recebe `ctx.onActivate` e `ctx.onDeactivate`. Os componentes de host de React e Vue passam a usar o mesmo controlador de slot dos outros, então o remote monta num `<div data-vitral-slot>` dentro do `div` do componente.
