# ilha

Micro-frontends sem burocracia. Um remote é só um módulo ES que sabe se montar
num elemento. O host só precisa da URL. Funciona com React, Next, Vue e Nuxt, e
um host React pode carregar um remote Vue (e vice-versa).

```
host (qualquer framework)                 remote (qualquer framework)
┌────────────────────────────┐   URL      ┌──────────────────────────────┐
│ configure({ remotes })     │ ─────────▶ │ ilha.json  { entry, css,     │
│ <Remote name="carrinho" /> │            │              integrity }     │
│                            │ ◀───────── │ remote.js  mount/update/     │
│ events (barramento global) │  import()  │            unmount           │
└────────────────────────────┘            └──────────────────────────────┘
```

## Por que é diferente

| Dor comum (Module Federation, single-spa) | Como a ilha resolve |
|---|---|
| Host e remote precisam de config de build combinada | Host não tem config de build nenhuma. Só `configure({ remotes })` em runtime. |
| `shared` / singletons quebram com versões diferentes de React/Vue | Por padrão cada remote leva o próprio framework, isolado na sua própria root. Nenhum conflito de versão. Compartilhar é opcional (import map). |
| Erro de um remote derruba a página | Cada remote tem estado de loading, erro e "tentar de novo" próprios. |
| CSS de um vaza no outro | `isolate="shadow"` coloca o remote num Shadow DOM, com o CSS dele dentro. |
| Executar JS de outra origem sem garantia | Allowlist de origens + verificação de hash SRI antes de executar. |
| Muitos conceitos (containers, exposes, lifecycles, root config) | Um contrato: `mount(el, props, ctx) → { update, unmount }`. |

## Uso

### Publicar um remote (React)

```js
// src/remote.jsx
import { reactRemote } from 'ilha/react'
import Carrinho from './Carrinho'
export default reactRemote(Carrinho)

// vite.config.js
import ilha from 'ilha/vite'
export default { plugins: [react(), ilha({ entry: 'src/remote.jsx' })] }
```

### Publicar um remote (Vue)

```js
// src/remote.js
import { vueRemote } from 'ilha/vue'
import Catalogo from './Catalogo.vue'
export default vueRemote(Catalogo, { setup: (app) => app.use(pinia) })
```

`vite build` gera `dist/remote.js`, `dist/remote.css` e `dist/ilha.json`
(com o hash `sha384` do JS). Suba a pasta em qualquer CDN com CORS.

Sem Vite? Qualquer bundler serve: basta gerar um módulo ES cujo `default`
tenha `mount(el, props, ctx)`.

### Consumir no host (React / Next)

```jsx
import { configure } from 'ilha'
import { Remote, useEventValue } from 'ilha/react'

configure({ remotes: '/remotes.json' })            // ou um objeto { nome: url }

function App() {
  const total = useEventValue('carrinho:total')
  return (
    <Remote
      name="carrinho"
      props={{ userId: 42 }}
      isolate="shadow"
      fallback={<Spinner />}
      error={(err, retry) => <button onClick={retry}>Tentar de novo</button>}
    />
  )
}
```

`<Remote>` já é `'use client'`. No Next ele renderiza o `fallback` no servidor
e monta o remote no cliente, então funciona no App Router e no Pages Router
sem `dynamic(..., { ssr: false })`.

### Consumir no host (Vue / Nuxt)

```vue
<script setup>
import { IlhaRemote } from 'ilha/vue'
</script>

<template>
  <IlhaRemote name="carrinho" :props="{ userId: 42 }" isolate="shadow">
    <template #fallback>Carregando…</template>
    <template #error="{ error, retry }"><button @click="retry">Tentar de novo</button></template>
  </IlhaRemote>
</template>
```

No Nuxt, chame `configure()` num plugin `.client.ts`. O componente renderiza o
fallback no SSR e monta o remote no cliente.

### Comunicação

```js
import { events } from 'ilha'
events.emit('carrinho:adicionar', produto)
const off = events.on('carrinho:adicionar', (p) => …)
events.last('usuario')          // último valor emitido
```

Dentro de remotes: `useIlha()` (contexto), `useEvent(tipo, fn)` e
`useEventValue(tipo)` existem em `ilha/react` e `ilha/vue`. O barramento é o
mesmo objeto para todos, mesmo que cada remote tenha sua cópia da lib.

### Configuração

```js
configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/ilha.json' }, // ou URL de um JSON
  allowedOrigins: ['https://cdn.empresa.com'], // padrão: página + origens registradas
  timeout: 15000,
  retries: 1,
  isolate: 'none',                              // ou 'shadow' para todos
})
```

Entradas podem ser objetos: `{ url, integrity, css, isolate }`. A `integrity`
declarada pelo host vence a do manifesto (fixe o hash no host quando o remote
for de terceiros).

## Segurança

- **Allowlist de origens**: nenhum código é importado de origem não permitida,
  nem mesmo se um manifesto apontar para fora.
- **SRI**: quando há `integrity`, a lib baixa o JS, confere o hash e executa
  exatamente os bytes verificados (via `blob:`). Com CSP, inclua `blob:` em
  `script-src`.
- **Sem `eval`**, sem iframes, sem globais além de um `Symbol.for('ilha.state.v1')`.
- Shadow DOM isola CSS, não JS: um remote ainda roda com os privilégios da
  página. Para código não confiável de verdade, use iframe.

## Dependências compartilhadas (opcional)

Para não baixar React/Vue duas vezes, marque-os como `shared` no remote e
declare um import map no host:

```js
ilha({ entry: 'src/remote.jsx', shared: ['react', 'react-dom', 'react-dom/client'] })
```

```html
<script type="importmap">
{ "imports": { "react": "https://esm.sh/react@19.2.0", "react-dom/client": "https://esm.sh/react-dom@19.2.0/client" } }
</script>
```

## Demo

```bash
pnpm install
pnpm demo
```

- http://localhost:5173 host React carregando um catálogo **Vue** (em Shadow DOM)
  e um carrinho **React**, mais um remote quebrado mostrando o tratamento de erro.
- http://localhost:5174 host Vue carregando os mesmos dois remotes.

Clicar num produto do catálogo (Vue) adiciona ao carrinho (React) pelo
barramento de eventos, e o contador do host atualiza.

## Estado

Protótipo 0.1. Testado: carregamento via manifesto com SRI, Shadow DOM, props
reativas, desmontar/remontar, StrictMode do React, tratamento de erro, SSR dos
componentes de host (React e Vue). Ainda não feito: modo dev com HMR
apontando para o servidor do remote, SSR do conteúdo do remote, exemplos em
Next e Nuxt reais, publicação no npm.
