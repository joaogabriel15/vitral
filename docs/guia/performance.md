# Performance

Comece com a configuração padrão. Otimize as áreas que o usuário realmente precisa carregar.

## Baixe antes de abrir

```ts
import { preload } from 'vitral'

preload('produtos')
```

O preload inicia o carregamento de JavaScript e CSS sem montar a área. Ele é útil no hover de um link ou depois da primeira tela.

## Adie áreas fora da tela

```jsx
<Remote
  name="comentarios"
  loading="lazy"
  fallback={<p>Carregando comentários…</p>}
/>
```

Reserve espaço no layout para evitar saltos quando a área aparecer.

| Opção | Uso |
| --- | --- |
| `loading="lazy"` | Montar perto de entrar na tela |
| `loading="idle"` | Montar quando o navegador estiver ocioso |
| `prefetch="hover"` | Antecipar o download ao passar o ponteiro |
| `prefetch="visible"` | Antecipar o download perto da tela |
| `priority="high"` | Priorizar downloads de uma área importante |
| `keepAlive` | Manter a área montada em cache ao sair; desativada, ela deve pausar trabalho desnecessário |

O keep-alive pode consumir memória e manter timers ativos. Use os hooks `ctx.onDeactivate` e `ctx.onActivate` para pausar e retomar trabalho.

## Dependências compartilhadas

Por padrão, cada remote leva seu framework e monta sua própria raiz. Isso reduz o acoplamento de versões, mas pode duplicar downloads.

Para tentar reutilizar uma versão compatível já oferecida na página:

```js
// vite.config.js do remote
vitral({ dedupe: ['react'] })
```

Se não houver versão compatível, o remote usa a própria cópia. O host React oferece seu React automaticamente. A opção antiga `shared`, baseada em import maps manuais, está depreciada; prefira `dedupe`.

## Meça no host

```ts
import { configure } from 'vitral'

configure({
  onMetric: ({ name, stage, duration }) => {
    console.log(name, stage, duration)
  },
})
```

As etapas são `manifest`, `js`, `css` e `mount`. Elas também aparecem como `performance.measure` no DevTools.

JavaScript e CSS começam a baixar em paralelo após o manifesto. O manifesto é revalidado ao ser solicitado; módulos já carregados ficam em cache na sessão. Um deploy novo não substitui automaticamente o código em uma aba aberta.

Veja [Publicar](./publicacao) para os cabeçalhos de cache, [Formas de usar](/formas-de-usar) para atualização durante a sessão e [Benchmarks](/benchmarks) para medições e método.
