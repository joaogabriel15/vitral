---
"vitral": minor
---

O plugin gera o `vitral.d.ts` com o Oxc (`isolatedDeclaration`) quando ele está disponível (Vite 8 ou `oxc-transform`) e os exports têm tipo explícito: as props saem em poucos milissegundos, sem montar um programa do TypeScript. Sem Oxc, ou se ele reclamar, usa o TypeScript como antes.

`npx vitral types` registra no `vitral-env.d.ts` o hash do manifesto de onde veio o tipo de cada remote, e o novo `npx vitral types --check` sai com erro quando algum manifesto mudou (útil no CI).
