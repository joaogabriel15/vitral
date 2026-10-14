# SHARED_READONLY

Alguém chamou `set` (ou `update`) numa chave criada com `provide(chave, valor, { writable: false })` sem ser o dono. Só quem chamou `provide` primeiro altera essa chave.

Em desenvolvimento o `set` lança este erro. Em produção a escrita é ignorada e sai um aviso no console.

## Como corrigir

Deixe o dono alterar o valor. Para mudanças controladas, o dono expõe ações no próprio valor:

```ts
// dono (host)
const carrinho = provide('carrinho', criarCarrinho([]), { writable: false })

function criarCarrinho(itens: Item[]) {
  return {
    itens,
    adicionar: (item: Item) => carrinho.set(criarCarrinho([...itens, item])),
  }
}

// remote
shared('carrinho').get()?.adicionar(item)
```

Se qualquer um pode alterar, crie a chave sem `writable: false`.
