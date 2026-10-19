# vitral/devtools

Painel para trocar a URL de um remote em desenvolvimento.

```ts
devtools(options?: { reload?: boolean }): () => void
getOverrides(): Record<string, string>
setOverride(name: string, url: string | null): void
activeOverrides(): ActiveOverride[]
clearOverrides(): void

interface ActiveOverride {
  name: string
  value: string                  // como foi pedido: URL ou apelido (pr-123)
  url?: string                   // URL do manifesto; vazia se o apelido não tem modelo
  source: 'aba' | 'navegador'    // ?vitral= nesta aba, ou localStorage
}
```

## Uso

```ts
import { devtools } from 'vitral/devtools'

if (import.meta.env.DEV) devtools()
```

Mostra um botão "vitral" no canto da página. Com trocas ativas, o botão mostra quantas são (`vitral (2)`). O painel lista todas, as de `?vitral=` desta aba e as guardadas no navegador, e tem "Limpar todos".

## Parâmetros

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `reload` | `true` | Recarrega a página ao mudar uma troca |

## Retorno

`devtools` devolve a função que remove o painel. `getOverrides` devolve as trocas guardadas no navegador. `setOverride(nome, url)` guarda uma troca no navegador; `url` pode ser um apelido (`pr-123`), resolvido por `configure({ devOverrides: { preview } })`. `setOverride(nome, null)` remove a troca da aba e do navegador. `activeOverrides` lista as trocas desta página. `clearOverrides` remove todas, como `?vitral=off`.

## Observações

::: warning Atenção
Fora de `localhost`, as trocas só valem com `configure({ devOverrides })`. Nunca ligue em produção.
:::
