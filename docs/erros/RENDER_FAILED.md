# RENDER_FAILED

O remote já estava montado e quebrou depois (erro de render ou num handler) e avisou o host com `ctx.reportError()`. Os adaptadores `reactRemote` e `vueRemote` fazem isso sozinhos.

## Como corrigir

O erro original fica em `error.cause`. No host, trate o erro em `onError`:

```ts
mountRemote(el, 'carrinho', props, {
  onError: (error) => console.error(error.cause),
})
```

Sem `onError`, o erro vai para o `console.error`.
