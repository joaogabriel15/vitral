# component

Cria um remote em JS ou TS puro a partir de uma função que devolve HTML.

```ts
component<P, S>(options: RenderFn<P, S> | { state?, render, mounted? }): RemoteModule<P>
html`...`: Template
unsafeHTML(markup: string): Template
render(view: Template | string | Node, el: Element): void
```

## Uso

```ts
import { component, html } from 'vitral'

export default component({
  state: { qtd: 0 },
  render: (props, state) => html`
    <p>Olá, ${props.nome}</p>
    <button onclick=${() => state.qtd++}>Cliques: ${state.qtd}</button>
  `,
})
```

Só a função também serve:

```ts
export default component((props) => html`<p>Olá, ${props.nome}</p>`)
```

## Parâmetros

| Opção | O que é |
| --- | --- |
| `render(props, state, ctx)` | Devolve o HTML |
| `state` | Estado local, ou uma função que o cria. Alterar um campo renderiza de novo |
| `mounted(el, state, ctx)` | Roda depois do primeiro render. Pode devolver uma limpeza |

## Retorno

Um remote com `mount`.

## Observações

- Valores em `html` são escapados. `unsafeHTML` insere HTML sem escapar.
- Mais exemplos em [JS e TS puro](/frameworks/javascript).
