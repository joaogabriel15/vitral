---
"vitral": minor
---

Duas opções novas no plugin Vite para o CSS do remote conviver com o CSS do host no modo escopo:

- `layers: 'flatten'` tira os `@layer` do CSS do remote mantendo a ordem. Assim o CSS sem camada do host (Tailwind v3, CSS legado) não vence mais os utilitários do Tailwind v4 do remote.
- `renameRegisteredProperties: true` renomeia as propriedades `--tw-*` registradas com `@property` para `--tw-<escopo>-*`. Assim um host com Tailwind v3 mantém os gradientes com um remote v4 na página.

```ts
vitral({ entry: 'src/remote.tsx', layers: 'flatten', renameRegisteredProperties: true })
```

As duas ficam desligadas por padrão.
