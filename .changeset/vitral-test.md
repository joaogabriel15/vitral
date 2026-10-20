---
'vitral': minor
---

`vitral test` e contratos do consumidor. `harness` (em `vitral/testing`) monta um remote com `ctx` simulado. `record()` grava no host as props, os updates e os eventos de cada remote em `<remote>.contract.json`. `npx vitral test --contract` reproduz esses casos no CI do remote, em happy-dom, e falha se o mount quebrar, se um evento que o host escuta sumir ou se as props não baterem com o `Props` local. `npx vitral test --since <url>` compara o `vitral.d.ts` publicado com o local e lista as mudanças que quebram o host.
