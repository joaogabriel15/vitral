---
'vitral': minor
---

`vitral/next-server`: `remoteProps(nome)` lê o `vitral.json` do remote no servidor a cada requisição, com cache curto. Passado ao `NextRemote` em `manifest`, o HTML já sai com o preload da versão publicada agora e o navegador não pede o manifesto.
