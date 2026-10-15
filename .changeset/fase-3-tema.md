---
"vitral": minor
---

Opção `theme: 'host'` no plugin Vite: o remote usa as variáveis do tema do host quando elas existem e as próprias quando não existem.

```ts
vitral({ entry: 'src/remote.tsx', theme: 'host' })
```

O plugin tira as variáveis de `:root`/`:host` do CSS do remote e troca cada `var(--x)` por `var(--x, <valor do build>)`, o mesmo resultado do `theme(reference)` do Tailwind v4. Desligado por padrão.
