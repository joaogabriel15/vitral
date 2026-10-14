---
"vitral": minor
---

Tipos das props entre deploys. O build do remote publica `vitral.d.ts` com o tipo das props do `export default` (desligue com `vitral({ types: false })`). No host, `npx vitral types` baixa esses arquivos e gera `vitral-env.d.ts`; com ele, `<Remote name="carrinho" props={…}>` (React, Preact, Solid) e `PropsOf<'carrinho'>` acusam prop errada na compilação.
