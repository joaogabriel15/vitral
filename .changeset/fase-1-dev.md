---
"vitral": minor
---

Modo dev com HMR: em `vite dev`, o plugin serve `/vitral.json` apontando para um módulo de desenvolvimento, com CORS e sem SRI. O módulo carrega o cliente HMR do Vite e, em React, o preâmbulo do Fast Refresh pela origem do remote. Editar o remote atualiza o host sem recarregar a página; onde o framework não tem HMR, só aquele remote é remontado. O CSS de dev sai com o mesmo escopo do build, e `server.origin` passa a apontar para o remote.
