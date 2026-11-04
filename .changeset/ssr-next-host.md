---
'vitral': minor
---

SSR do remote dentro do `NextRemote`: `remoteProps(nome, { ssr: { nome: { render, props } } })` devolve `vitralSsr[nome]`, que vai no `ssr` do `NextRemote` (e do `<Remote>` de `vitral/react`). O HTML aparece antes do JS e o remote hidrata. `reactRender(C, { state })` busca o estado no servidor; ele vai com o HTML e chega em `useInitialState()` e em `ctx.initialState`, também no `vitral/edge`.
