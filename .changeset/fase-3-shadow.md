---
"vitral": minor
---

Estilos do host no Shadow DOM (`isolate: 'shadow'`):

- `@font-face` do remote sobe para o documento, sem duplicar. Antes a fonte própria do remote não carregava no Chrome nem no Firefox.
- `@import` no CSS do remote vira outra folha adotada no shadow root, antes da que importa. Antes era ignorado. A URL importada precisa de CORS (o Google Fonts tem).
- CSS base do host no shadow root, um `CSSStyleSheet` por arquivo compartilhado entre todos os remotes:

  ```ts
  configure({ styles: { inherit: ['/assets/base.css'] } })
  ```

  ```html
  <vitral-remote name="carrinho" isolate="shadow" inherit-styles="/assets/base.css"></vitral-remote>
  ```

- `class` e `data-theme` do `<html>` são copiados para a raiz do remote, então `dark:` e `[data-theme]` funcionam no Shadow DOM. Para desligar: `configure({ styles: { mirrorTheme: false } })`.

O código do Shadow DOM saiu do núcleo para um módulo carregado só quando um remote usa `isolate: 'shadow'`. O host mínimo ficou menor (3,38 kB para 3,26 kB).
