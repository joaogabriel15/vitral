---
'create-vitral': patch
---

Host vanilla e Lit: o `vite.config.js` gerado declara `vitral/auto` e `vitral/element` em `optimizeDeps.include`, e a página não recarrega mais no primeiro acesso.
