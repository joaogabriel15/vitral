---
"vitral": minor
---

`dedupe` de pacotes CommonJS como o axios: os nomes do `module.exports` saem também quando ele é uma função, nomes reservados como `delete` não quebram mais o build, e o `require()` de um pacote CommonJS recebe os métodos que só existem no `default` (`axios.get`). Com CSS escopado, os portais que o React do remote coloca no `document.body` (dialogs e popovers do Radix, por exemplo) ganham o escopo do remote sozinhos, sem mudar a biblioteca de UI. Sem Navigation API, o `VitralNext` troca os cliques em `<a>` comuns para rota de remote por `Router.push`.
