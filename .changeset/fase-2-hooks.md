---
"vitral": minor
---

Hooks do contexto compartilhado em cada framework. Todos re-renderizam só quando o valor muda; com seletor, só quando o resultado do seletor muda (`Object.is`). A assinatura acaba junto com o componente.

```ts
const nome = useShared('usuario', (u) => u?.nome) // React e Preact: o valor
const usuario = useShared('usuario')              // Vue: ref (escreve com .value); Solid: accessor
usuario = injectShared('usuario')                 // Angular: Signal
const tema = shared('tema')                       // Svelte: $tema (contrato de store)
usuario = new SharedController(this, 'usuario')   // Lit (vitral/element): this.usuario.value
```
