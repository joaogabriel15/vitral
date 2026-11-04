---
'vitral': minor
---

`remoteWorker` em `vitral/sw`: service worker pronto que guarda os remotes no cache durante o `install` (o Chrome gera o cache de código completo), usa a Static Routing API para `split/*` no Chrome 123+, busca o manifesto na rede primeiro e tira do cache as versões antigas. `filesOf(manifesto, url)` lista os arquivos de um manifesto já lido.
