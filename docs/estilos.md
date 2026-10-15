# Estilos do host no remote

O remote pode herdar o tema, o dark mode e o CSS base do host, em escopo ou em
Shadow DOM. Tudo aqui é opcional: sem nenhuma opção, o remote usa só o próprio
CSS, como antes.

| Quero | Use |
| --- | --- |
| Remote com as cores e fontes do host (Tailwind v4) | Pacote de tokens com `theme(reference)` no remote |
| O mesmo, sem pacote de tokens ou sem Tailwind | `vitral({ theme: 'host' })` |
| `dark:` do remote seguindo o `html.dark` do host | Já funciona no escopo; no Shadow DOM, `mirrorTheme` (ligado) |
| CSS base do host dentro do Shadow DOM | `configure({ styles: { inherit: ['/base.css'] } })` |
| Fonte do remote no Shadow DOM | Já funciona: `@font-face` sobe para o documento |
| Host com CSS legado sem `@layer` | `vitral({ layers: 'flatten' })` |
| Host com Tailwind v3 e remote com v4 | `vitral({ renameRegisteredProperties: true })` |

## Tema compartilhado com Tailwind v4

Ponha os tokens num pacote usado pelos dois lados.

```css
/* @empresa/tema/tokens.css */
@theme {
  --color-marca: oklch(0.55 0.2 290);
  --font-sans: "Manrope", sans-serif;
}
```

O host emite todas as variáveis no `:root`:

```css
/* host */
@import "tailwindcss";
@import "@empresa/tema/tokens.css" theme(static);
```

O remote usa o tema só como referência. Nenhum token dele sobrepõe o do host:

```css
/* remote */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) theme(reference);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities);
@import "@empresa/tema/tokens.css" theme(reference);
```

Os utilitários do remote viram `var(--color-marca, <valor do build>)`: usam a
variável do host quando ela existe e o valor próprio quando não existe. Trocar
a marca no host muda o remote sem rebuild.

Limites:

- Tokens com `@theme inline` nunca viram variável. Compartilhe as variáveis
  cruas (como no shadcn/ui), não as `inline`.
- Sombras, breakpoints, z-index, valores arbitrários e cores com opacidade
  (`bg-marca/50`) em navegadores sem `color-mix` não passam por variável:
  ficam com o valor do build do remote.

## `theme: 'host'`

Para quem não tem pacote de tokens ou não usa Tailwind.

```js
// vite.config.js do remote
vitral({ entry: 'src/remote.jsx', theme: 'host' })
```

O plugin tira as variáveis dos blocos `:root`, `:host`, `html` e `body` do CSS
do remote e troca cada `var(--x)` por `var(--x, <valor do build>)`. Variáveis
encadeadas viram fallbacks encadeados. Com o Tailwind v4, o CSS gerado é igual
ao do `theme(reference)` (há teste que compara os dois).

Variáveis em `:root.dark`, `html[data-theme=x]` ou dentro de `@media` também
saem e não viram fallback: com `theme: 'host'`, quem decide o tema é o host.

## Dark mode

As variáveis que o host troca em `.dark` herdam para o remote, inclusive no
Shadow DOM.

Os utilitários `dark:` com a variante por classe
(`@custom-variant dark (&:where(.dark, .dark *))`) funcionam no escopo, porque o
`<html>` é ancestral do remote. No Shadow DOM o seletor não atravessa o shadow
root, então a lib copia `class` e `data-theme` do `<html>` para a raiz do
remote e acompanha as mudanças. Para desligar:

```js
configure({ styles: { mirrorTheme: false } })
```

## CSS base do host no Shadow DOM

```js
configure({ styles: { inherit: ['/assets/base.css'] } })
```

```html
<vitral-remote name="carrinho" isolate="shadow" inherit-styles="/assets/base.css"></vitral-remote>
```

A lib cria um `CSSStyleSheet` por arquivo e adota o mesmo objeto em todos os
shadow roots, antes do CSS do remote. URLs relativas valem a partir da página.
No modo escopo não faz nada: o CSS do host já está na página.

## Fontes e `@import` no Shadow DOM

- `@font-face` é ignorado dentro de shadow root no Chrome e no Firefox. A lib
  sobe essas regras para o documento, uma vez só.
- Folhas adotadas não aceitam `@import`. Os imports locais o Vite já embute no
  build. Os externos (Google Fonts, por exemplo) a lib baixa e adota como outra
  folha, antes da que importa. A URL precisa de CORS. Condições do `@import`
  (`media`, `supports`, `layer`) são ignoradas.

## Camadas no modo escopo

As camadas do remote se fundem com as do host de mesmo nome, e CSS sem camada
(Tailwind v3, CSS legado) vence todo CSS em camada. Um `button { background:
green }` no host pinta os botões do remote.

```js
vitral({ entry: 'src/remote.jsx', layers: 'flatten' })
```

O plugin tira os `@layer` mantendo a ordem: cada camada na posição em que foi
declarada e o CSS sem camada no fim. O seletor escopado dá a especificidade
extra para vencer o host. Diferenças para a cascata com camadas: entre regras
do próprio remote, a especificidade passa a contar entre camadas, e
`!important` não inverte mais a ordem das camadas.

No Shadow DOM as camadas são independentes e isso não é necessário.

## Tailwind v3 e v4 na mesma página

O Tailwind v4 registra `--tw-gradient-from`, `-via` e `-to` como `<color>` com
`@property`. O registro vale para a página toda, e os gradientes do v3 (que
põem cor e posição na mesma variável) param de funcionar.

```js
vitral({ entry: 'src/remote.jsx', renameRegisteredProperties: true })
```

O plugin renomeia as propriedades `--tw-*` registradas pelo remote para
`--tw-<escopo>-*`, no `@property` e em cada uso. Propriedades registradas fora
do `--tw-` não mudam.

## Testes

`e2e/estilos.spec.ts` monta o mesmo remote Tailwind v4 com e sem as opções em
hosts com Tailwind v4, CSS legado e Tailwind v3 (`examples/estilos`), em escopo
e Shadow DOM.
