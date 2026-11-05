---
"vitral": minor
---

Correções de um teste com host Next.js e remote com `dedupe`:

- `retry()` e "Tentar de novo" baixam o remote de novo depois de uma falha de rede, também com a CSP sem `blob:`: a nova tentativa usa uma URL nova (`?vitral-retry=1`) e o navegador confere o hash. Antes, o navegador repetia o erro guardado sem fazer requisição.
- Sem a prop `error`, `<Remote>` (React, Preact, Solid) e `<VitralRemote>` (Vue) mostram "Não foi possível carregar." com o botão "Tentar de novo", como o `<vitral-remote>`. `error={null}` não mostra nada.
- `<VitralNext />` põe no HTML as dicas de preload do remote da rota aberta. Vale também na página que só desenha o `NextRemote` no navegador (depois do login). Com `pageProps`, usa o manifesto lido no servidor.
- `build.rollupOptions.output` do remote não cria mais uma terceira saída: as opções valem nas duas, e `manualChunks` vale só no build dividido, sem juntar a cópia própria do `dedupe` com o código do app.
- `vitral/sw` lista só o que a página usa: sem o arquivo único quando há build dividido (`single: true` inclui) e, com `offered`, sem a cópia própria dos grupos que o host oferece.
- `vitral doctor`: com build dividido, o tamanho é o JS da montagem; as cópias próprias e o arquivo único aparecem à parte. `--stats` avisa quando os stats não têm os módulos da maior parte da rota.
