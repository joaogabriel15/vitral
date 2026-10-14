# Estilos

Use Tailwind ou qualquer CSS no remote. O CSS vai junto com o remote: o host não precisa conhecer as classes dele.

Há dois modos de isolar o CSS.

| Modo | Como ligar | CSS do remote afeta o host? | CSS do host afeta o remote? |
| --- | --- | --- | --- |
| Escopo (padrão) | nada | Não | Sim, o que não for sobrescrito |
| Shadow DOM | `isolate="shadow"` | Não | Só o que herda (fonte, cor, variáveis CSS) |

## Escopo

O plugin `vitral/vite` prefixa cada seletor do CSS do remote com `[data-vitral-scope="nome"]`:

```css
/* CSS do remote */
.botao { color: red }
:root { --cor: blue }
* { box-sizing: border-box }

/* depois do build */
[data-vitral-scope="carrinho"] .botao { color: red }
[data-vitral-scope="carrinho"] { --cor: blue }
[data-vitral-scope="carrinho"], [data-vitral-scope="carrinho"] * { box-sizing: border-box }
```

`:root`, `:host`, `html` e `body` viram a raiz do remote. Assim o preflight e o tema do Tailwind do remote valem só dentro dele. `@keyframes` e regras aninhadas ficam como estão.

Para desligar:

```js
vitral({ entry: 'src/remote.jsx', scopeCss: false })
```

## Shadow DOM

```jsx
<Remote name="carrinho" isolate="shadow" />
```

```html
<vitral-remote name="carrinho" isolate="shadow"></vitral-remote>
```

Ou para todos os remotes:

```ts
configure({ isolate: 'shadow' })
```

O que a lib faz no Shadow DOM:

- Baixa o CSS do remote uma vez e adota a mesma folha em todas as instâncias.
- Sobe as regras `@property` para o documento, porque o navegador as ignora dentro de shadow roots. Sem isso, `shadow-lg`, `ring-*`, gradientes e transforms do Tailwind v4 ficam sem efeito.
- Reescreve `url()` relativas para apontar para a origem do remote, então fontes e imagens continuam carregando.

Shadow DOM isola o CSS, não o JS. Veja [Segurança](./seguranca).

## CSS extra

Para carregar CSS além do que o build gera:

```ts
configure({
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/vitral.json', css: ['https://cdn.empresa.com/marca.css'] },
  },
})
```

Um arquivo de CSS que falha não impede o remote de aparecer.

::: info Em breve
Herdar o tema, o dark mode e o CSS base do host, nos dois modos; `@font-face` e `@import` no Shadow DOM; e o CSS legado do host sem sobrepor o Tailwind v4 do remote.
:::
