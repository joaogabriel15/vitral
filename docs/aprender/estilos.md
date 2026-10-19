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

## Portais (Radix, Headless UI, MUI)

Popovers, menus e dialogs costumam ir para o `document.body`. No Shadow DOM, isso os tira do shadow root e eles perdem o CSS do remote. Use `ctx.portalContainer`: um elemento dentro do shadow root, com o CSS, as variáveis e o tema (`class` e `data-theme`) do remote. Sem Shadow DOM, ele é o próprio `document.body`.

Radix:

```jsx
import * as Popover from '@radix-ui/react-popover'
import { usePortalContainer } from 'vitral/react'

function Ajuda() {
  const container = usePortalContainer()
  return (
    <Popover.Root>
      <Popover.Trigger>Ajuda</Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content>Texto da ajuda</Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

O mesmo vale para `Dialog.Portal` e `DropdownMenu.Portal`.

Headless UI (v2) não tem prop de destino. `MenuItems`, `PopoverPanel`, `ListboxOptions` e `ComboboxOptions` vão para o `body` com `portal` ou `anchor` (`anchor` liga `portal`). Sem as duas, ficam no lugar, dentro do shadow root, e você posiciona com CSS:

```jsx
<Menu as="div" className="relative">
  <MenuButton>Opções</MenuButton>
  <MenuItems className="absolute right-0 mt-2">…</MenuItems>
</Menu>
```

O `Dialog` do Headless UI sempre vai para o `document.body` e não dá para mudar. No Shadow DOM, use outro dialog (o do Radix com `container`, por exemplo).

MUI: `Popover`, `Popper`, `Modal` e os que usam esses (`Menu`, `Dialog`, `Tooltip`) aceitam `container`. Com `disablePortal`, ficam no lugar:

```jsx
<Menu container={usePortalContainer()} open={aberto} anchorEl={botao}>…</Menu>
<Popper disablePortal open={aberto} anchorEl={botao}>…</Popper>
```

Para todos de uma vez, no tema: `components: { MuiPopover: { defaultProps: { container } }, MuiPopper: { … }, MuiModal: { … } }`. O CSS do MUI (Emotion) também precisa ir para o shadow root: `createCache({ key: 'css', container: ctx.shadowRoot })` num `CacheProvider`.

Vue:

```vue
<script setup>
import { usePortalContainer } from 'vitral/vue'
const portal = usePortalContainer()
</script>

<template>
  <Teleport :to="portal"><div class="menu">…</div></Teleport>
</template>
```

Em outros frameworks, use `ctx.portalContainer` direto.

## Custom elements de cada remote

Dois remotes podem usar versões diferentes do mesmo design system, cada uma com o seu `<ds-button>`. No registro global (`customElements`), a segunda definição lança erro e o remote não monta.

No Shadow DOM, cada remote recebe `ctx.customElements`. Em navegadores com Scoped Custom Element Registries (Chrome e Edge 146+, Safari 26+), é um `CustomElementRegistry` só do remote, e o shadow root e o elemento `el` do mount são criados com ele. Defina as tags nele:

```js
export default {
  mount(el, props, ctx) {
    const registry = ctx.customElements ?? customElements // hosts antigos não mandam
    registry.define('ds-button', DsButton)
    el.innerHTML = '<ds-button>Comprar</ds-button>'
    return { unmount: () => el.replaceChildren() }
  },
}
```

O que for criado com `innerHTML` dentro de `el` usa o registro do remote. `document.createElement(tag)` usa o global; passe o registro: `document.createElement('ds-button', { customElementRegistry: ctx.customElements })`.

O registro é um por remote e vale para todas as montagens dele. Uma definição não pode ser desfeita, então `define` de uma tag que já existe não lança: fica a definição que já existe.

Sem suporte (Firefox até a 158, navegadores antigos) e fora do Shadow DOM, `ctx.customElements` é o registro global. Quando um remote define uma tag que outro remote já definiu, fica a primeira definição, o remote monta mesmo assim e, em dev, o console mostra:

```
[vitral] v2: <ds-button> já foi definido por v1; fica essa definição. Sem Scoped Custom Element Registries, os remotes dividem o registro global.
```

Quem chama `customElements.define` direto, sem passar por `ctx.customElements`, continua no registro global, como antes.

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
