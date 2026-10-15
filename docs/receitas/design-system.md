# Design system

Os componentes do design system entram no build de cada remote, como qualquer dependência. O vitral não muda isso.

## Pacote de componentes

```bash
npm install @empresa/ui
```

```jsx
import { Botao } from '@empresa/ui'
import '@empresa/ui/estilos.css'

export default reactRemote(function Carrinho() {
  return <Botao>Finalizar</Botao>
})
```

O CSS do pacote entra no CSS do remote e recebe o escopo do plugin. Ele não muda o host nem os outros remotes.

## Versões diferentes

Cada remote pode estar numa versão do design system. Como o CSS de cada um tem escopo próprio, duas versões convivem na mesma página.

Para todos andarem juntos, fixe a versão num lugar só (catálogo do pnpm, Renovate ou Dependabot) e faça o build dos remotes quando ela mudar.

## Tokens

Variáveis CSS do host chegam ao remote por herança quando o remote não declara a mesma variável. Com Tailwind, os dois importam o mesmo arquivo de tokens. Veja [Tailwind](./tailwind#mesmas-cores-no-host-e-no-remote).

## Web Components

Um design system feito de Web Components (Lit, Stencil) funciona igual em todos os frameworks. Registre cada tag uma vez só:

```ts
if (!customElements.get('ui-botao')) customElements.define('ui-botao', UiBotao)
```

Sem essa checagem, o segundo remote que registrar a mesma tag lança erro.

::: info Em breve
Tema e CSS base do host aplicados aos remotes em runtime, inclusive no Shadow DOM.
:::
