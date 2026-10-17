# Estilos, Tailwind e tema

O CSS de cada remote vale só dentro dele. O host não precisa conhecer as classes do remote.

## Quando usar cada modo

| Modo | Como ligar | CSS do remote afeta o host? | CSS do host afeta o remote? |
| --- | --- | --- | --- |
| Escopo (padrão) | nada | Não | Sim, o que não for sobrescrito |
| Shadow DOM | `isolate="shadow"` | Não | Só o que herda (fonte, cor, variáveis CSS) |
| [Iframe](./iframe) | `isolate="iframe"` | Não | Não |

## Escopo

O plugin prefixa cada seletor do CSS do remote:

```css
/* CSS do remote */
.botao { color: red }

/* depois do build */
[data-vitral-scope="carrinho"] .botao { color: red }
```

`:root`, `html` e `body` viram a raiz do remote. O preflight do Tailwind do remote não muda o host.

## Shadow DOM

```jsx
<Remote name="carrinho" isolate="shadow" />
```

```ts
configure({ isolate: 'shadow' }) // para todos os remotes
```

Sombras, rings, gradientes e fontes do Tailwind v4 funcionam dentro do Shadow DOM.

## Tailwind

```js
// vite.config.js do remote
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitral from 'vitral/vite'

export default { plugins: [react(), tailwindcss(), vitral()] }
```

```css
/* src/estilos.css */
@import "tailwindcss";
```

O remote leva o próprio CSS. Classes arbitrárias como `h-[37px]` funcionam.

## Usar o tema do host

Com Tailwind v4 e um pacote de tokens usado pelos dois lados:

```css
/* @empresa/tema/tokens.css */
@theme {
  --color-marca: oklch(0.55 0.2 290);
}
```

```css
/* host */
@import "tailwindcss";
@import "@empresa/tema/tokens.css" theme(static);
```

```css
/* remote */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) theme(reference);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities);
@import "@empresa/tema/tokens.css" theme(reference);
```

O remote usa a cor do host quando ela existe. Trocar a marca no host muda o remote sem novo build.

Sem pacote de tokens ou sem Tailwind:

```js
vitral({ theme: 'host' })
```

Cada `var(--x)` do remote passa a usar o valor do host quando ele existe.

## Dark mode

As variáveis que o host troca em `.dark` chegam ao remote. No Shadow DOM, a lib copia `class` e `data-theme` do `<html>` para o remote, então `dark:` funciona.

## CSS do host no Shadow DOM

```js
configure({ styles: { inherit: ['/assets/base.css'] } })
```

```html
<vitral-remote name="carrinho" isolate="shadow" inherit-styles="/assets/base.css"></vitral-remote>
```

## CSS extra num remote

```ts
configure({
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/vitral.json', css: ['https://cdn.empresa.com/marca.css'] },
  },
})
```

## Opções

No plugin (`vitral/vite`):

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `scopeCss` | `true` | Prefixa o CSS do remote. `false` desliga |
| `theme` | nenhum | `'host'`: variáveis do remote viram fallback do valor do host |
| `layers` | nenhum | `'flatten'`: use quando o host tem CSS sem `@layer` (Tailwind v3, CSS legado) que sobrescreve o remote |
| `renameRegisteredProperties` | `false` | Use quando o host tem Tailwind v3 e o remote, v4. Evita quebrar os gradientes do host |

Em `configure`:

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `isolate` | `'none'` | Modo de todos os remotes |
| `styles.inherit` | `[]` | CSS do host dentro de cada Shadow DOM |
| `styles.mirrorTheme` | `true` | Copia `class` e `data-theme` do `<html>` para o Shadow DOM |
