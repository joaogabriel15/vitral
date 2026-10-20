# Configurar host e remote

Dois lados. O **remote** (filho) publica um componente. O **host** (pai) mostra o componente. O host não usa plugin de build.

<div class="vt-split">
<div>

### Remote (filho)

```jsx
// src/App.jsx
export default function Carrinho({ userId }) {
  return <p>Carrinho de {userId}</p>
}
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

`vite build` gera `dist/vitral.json`.

</div>
<div>

### Host (pai)

```jsx
// main.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: {
    carrinho: 'https://cdn.empresa.com/carrinho/vitral.json',
  },
})

export const App = () => <Remote name="carrinho" props={{ userId: 42 }} />
```

Sem mudança no `vite.config` do host.

</div>
</div>

## Remote

1. Exporte o componente como `default`.
2. Adicione `vitral()` de `vitral/vite` nos plugins.
3. Rode `vite build` e publique `dist`.

O plugin descobre o framework pelos outros plugins do Vite e embrulha o `export default`. Um export que já tem `mount` é usado como está. Por isso `reactRemote(App)` à mão é opcional.

A entrada padrão é `src/remote.*` ou `src/App.*`. Para outro arquivo:

```js
vitral({ entry: 'src/Carrinho.jsx' })
```

| Opção do plugin | O que faz |
| --- | --- |
| `entry` | Arquivo cujo `export default` é o remote |
| `dedupe` | Usa o React ou o Vue da página. Veja [Dedupe](./dedupe) |
| `exposes` | Publica mais partes. Veja [Exposes](./exposes) |
| `theme` | `'host'`: usa as variáveis CSS do host. Veja [Estilos](./estilos) |
| `adapter` | `false`: usa o `export default` sem embrulhar |

Todas as opções: [`vitral/vite`](/referencia/vite).

## Host

1. Chame `configure` uma vez, antes de renderizar.
2. Use o componente de host do seu framework.

| Framework do host | Componente |
| --- | --- |
| React, Next | `<Remote name props>` de `vitral/react` |
| Vue, Nuxt | `<VitralRemote name :props>` de `vitral/vue` |
| Outros | `<vitral-remote name props>` de `vitral/element` |

### Opções de `configure`

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `remotes` | nenhum | Mapa `nome → URL do vitral.json` (ou entrada completa), ou a URL de um JSON com esse mapa |
| `allowedOrigins` | página e URLs registradas | Origens de onde é permitido carregar código. `['*']` libera tudo |
| `timeout` | `15000` | Tempo máximo de cada download, em ms |
| `retries` | `1` | Tentativas extras se o download falhar |
| `maxStale` | nenhum | Usa o `vitral.json` salvo há até N segundos sem esperar a rede. Veja [Carregamento](/aprender/carregamento#visita-de-volta-sem-esperar-o-manifesto) |
| `isolate` | `'none'` | `'shadow'` ou `'iframe'` para todos os remotes |
| `devOverrides` | `false` | Aceita `?vitral=nome@url` fora de `localhost`. `{ preview }` também resolve `?vitral=nome@pr-123`. Nunca em produção |
| `onMetric` | nenhum | Recebe `{ name, stage, start, duration }` de cada etapa |
| `styles` | nenhum | `{ inherit, mirrorTheme }` para o Shadow DOM |

Referência completa: [`configure`](/referencia/vitral/configure).

::: tip Nota
Host e remote não precisam usar o mesmo framework. Um host React mostra um remote Vue.
:::
