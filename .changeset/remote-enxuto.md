---
'vitral': patch
---

Remotes menores e com menos pedidos:

- Remotes Vue, Lit, Web Component e JS puro não levam mais o código do host (o `<vitral-remote>`, o loader e os chunks sob demanda dele). No remote de exemplo em JS puro, o código que o navegador baixa caiu de cerca de 26 kB em 7 arquivos para 2,8 kB num só, sem compressão.
- Remotes React não baixam mais o escopo dos portais num arquivo à parte: são menos de 400 bytes no próprio remote, um pedido a menos por remote.

Rebuilde os remotes para ter a mudança.
