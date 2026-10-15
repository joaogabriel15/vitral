---
"vitral": minor
---

`dedupe` no plugin Vite (`vitral({ dedupe: ['react'] })`): o remote usa o framework que já está na página, se a versão estiver na faixa (padrão `^` da versão instalada; exata para Svelte e Angular), ou a própria cópia, que vira um chunk separado. O `<Remote>` de `vitral/react` oferece o React do host sem configuração, e `configure({ dedupe })` cobre os outros casos. Sem nada na página, o primeiro remote oferece a própria cópia aos outros desde o início do download, então três remotes React baixam o React uma vez. O protocolo ganha o método `dedupe`, instalado sob demanda. A opção `shared` (import map) continua funcionando e passa a ser obsoleta.
