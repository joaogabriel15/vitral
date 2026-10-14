---
"vitral": minor
---

Remote sem adaptador: com `vitral()` no `vite.config`, basta `export default App`. O plugin descobre o framework pelos plugins do Vite (React, Vue, Svelte, Solid, Preact, Angular) e embrulha o export com o adaptador certo. Sem plugin de framework, uma classe de Web Component vira `elementRemote` e uma função vira `component`. Um export com `mount` é usado como está.

- `entry` ficou opcional: o padrão é `src/remote.*` ou `src/App.*`.
- Opção `adapter` para forçar um adaptador (`'react'`, `'vue'`…) ou desligar (`false`).
