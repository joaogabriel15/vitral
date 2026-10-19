---
"create-vitral": patch
---

Template Angular: o `vite.config.js` gerado usa `fileURLToPath` para achar o `tsconfig.json`. Antes, no Windows e em pastas com espaço ou acento, o build e o HMR falhavam.
