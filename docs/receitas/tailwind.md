# Tailwind

Cada remote roda o próprio Tailwind e leva o CSS no build. O host não precisa escanear os arquivos do remote.

## Remote com Tailwind v4

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitral from 'vitral/vite'

export default {
  plugins: [react(), tailwindcss(), vitral({ entry: 'src/remote.jsx' })],
}
```

```css
/* src/carrinho.css, importado pelo componente */
@import "tailwindcss";
```

```jsx
import './carrinho.css'

export default function Carrinho() {
  return <div className="rounded-lg p-4 shadow-lg ring-1 ring-black/5 h-[37px]">…</div>
}
```

Classes arbitrárias (`h-[37px]`) funcionam, porque o CSS sai do build do próprio remote.

## O que o plugin faz com esse CSS

- No modo escopo, o preflight e o tema do remote passam a valer só dentro dele. O `<h1>` do host não muda.
- Com `isolate="shadow"`, as regras `@property` do Tailwind v4 sobem para o documento. Sombras, rings e gradientes funcionam dentro do Shadow DOM.

Detalhes em [Estilos](/guia/estilos).

## Mesmas cores no host e no remote

Uma opção para usar as mesmas cores é importar um pacote de tokens nos dois projetos:

```css
/* @empresa/tema/tokens.css */
@theme {
  --color-marca: oklch(0.55 0.2 290);
}
```

```css
/* host e remote */
@import "tailwindcss";
@import "@empresa/tema/tokens.css";
```

Nesse modelo, mudar o pacote exige novo build. Para herdar os valores do host em runtime, use `theme(reference)` ou `vitral({ theme: 'host' })`, conforme o [guia de estilos](/estilos).
