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

## watchLeaks

Avisa quando um remote sai da página e deixa ouvintes em `window` ou `document`, ou um `setInterval` aberto.

Hoje, o vazamento só aparece como página lenta depois de muitas trocas de rota, e o Memory do DevTools não diz de qual remote ele veio.

Com vitral:

```ts
import { watchLeaks } from 'vitral/devtools'

if (import.meta.env.DEV) watchLeaks()
```

```
[vitral] carrinho saiu da página e deixou 2 itens: window.resize, setInterval. Use ctx.signal ou limpe no unmount.
```

```ts
watchLeaks(options?: { delay?: number; onLeak?: (r: LeakReport) => void }): () => void

interface LeakReport {
  name: string
  listeners: { target: 'window' | 'document'; type: string; stack?: string }[]
  intervals: { stack?: string }[]
}
```

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `delay` | `200` | Espera depois do unmount antes de conferir, em ms |
| `onLeak` | aviso no console | Recebe cada relatório |

- O dono de cada ouvinte vem da pilha da chamada: arquivos da pasta do remote.
- Ouvintes com `once` ou com `signal` não contam.
- Devolve a função que desliga. Use só em desenvolvimento.

## Observações

::: warning Atenção
Fora de `localhost`, as trocas só valem com `configure({ devOverrides })`. Nunca ligue em produção.
:::
