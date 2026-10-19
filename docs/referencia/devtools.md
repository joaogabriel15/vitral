# vitral/devtools

Painel para trocar a URL de um remote em desenvolvimento.

```ts
devtools(options?: { reload?: boolean }): () => void
getOverrides(): Record<string, string>
setOverride(name: string, url: string | null): void
```

## Uso

```ts
import { devtools } from 'vitral/devtools'

if (import.meta.env.DEV) devtools()
```

Mostra um botão "vitral" no canto da página.

## Parâmetros

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `reload` | `true` | Recarrega a página ao mudar uma troca |

## Retorno

`devtools` devolve a função que remove o painel. `getOverrides` devolve as trocas guardadas. `setOverride(nome, null)` remove uma troca.

## Observações

::: warning Atenção
Fora de `localhost`, as trocas só valem com `configure({ devOverrides: true })`. Nunca ligue em produção.
:::
