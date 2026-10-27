---
"vitral": minor
---

Next.js sem Multi-Zones: `vitral/next-config` (`withVitral`) gera rewrites, headers de cache e as ofertas de `dedupe` do host; `vitral/next-host` traz `VitralNext` (registro, preload e navegação sem reload para rotas de remote) e `NextRemote` (o roteador do host no remote); `devUrl` liga o dev server do remote em `next dev`, com HMR. O modo `next` do plugin lê os `paths` do tsconfig de cada pacote (também no pré-bundle de dev), importa `.svg` como componente e builda em produção com `NODE_ENV=development` no `.env`. `dedupe: ['pacote/*']` compartilha um pacote publicado como código-fonte, inclusive arquivos internos que ele reexporta. O build dividido publica módulos de teste do SRI (CSP sem `data:`/`blob:`) e a lista `split.lazy`, usada por `preload(nome, { routes: true })`. Novos: `vitral/sw` (`remoteFiles`), `sideEffectFree`, `integrity: false` no registro e `dedupe` com módulos carregados sob demanda.
