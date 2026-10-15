---
"vitral": minor
---

Contexto compartilhado: `provide` cria uma chave e vira dono dela, `shared` lê, altera e assina, e `batch` agrupa mudanças numa notificação. Host e remotes veem o mesmo valor, mesmo com cópias diferentes da lib na página.

```ts
import { provide, shared } from 'vitral'

const usuario = provide('usuario', { id: 42, nome: 'Ana' })
provide('tema', 'claro', { writable: false }) // só o dono altera
shared('tema').subscribe((tema) => console.log(tema))
usuario.set({ id: 7, nome: 'Bia' })
```

- Tipos por chave com `declare module 'vitral' { interface Shared { … } }`.
- `set` numa chave com `writable: false` sem ser o dono lança `SHARED_READONLY` em desenvolvimento e é ignorado com aviso em produção.
- `ctx.shared` no remote: as assinaturas são canceladas e as chaves soltas no unmount.
- No servidor nada fica em variável global. No cliente, o store lê os valores do `<script type="application/json" data-vitral-shared>`.
- O store fica fora do host mínimo: só entra no bundle de quem usa.
