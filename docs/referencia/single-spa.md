# vitral/single-spa

Embrulha os lifecycles de um app do single-spa no contrato `mount(el, props, ctx)`. O app não muda e continua funcionando nos hosts single-spa.

```ts
singleSpaRemote<P>(lifecycles: SingleSpaLifecycles | { default: SingleSpaLifecycles }): RemoteModule<P>
```

## Uso

```js
// src/vitral-remote.js
import { singleSpaRemote } from 'vitral/single-spa'
import * as lifecycles from './main' // exporta bootstrap, mount e unmount

export default singleSpaRemote(lifecycles)
```

```js
// vite.vitral.config.mjs
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/vitral-remote.js' })] }
```

`npx vitral migrate` gera esses dois arquivos. Veja [CLI](./cli#vitral-migrate).

Funciona com os lifecycles de `single-spa-react`, `single-spa-vue`, `single-spa-angular`, `single-spa-svelte` e com lifecycles escritos à mão. Cada lifecycle pode ser uma função ou uma lista de funções.

## Comportamento

| single-spa | `singleSpaRemote` |
| --- | --- |
| `bootstrap` | Roda uma vez, antes do primeiro `mount`. Se falhar, roda de novo na próxima montagem |
| `mount(props)` | `props` do host mais `name` (o nome do remote) e `domElement` (o elemento do remote) |
| `unmount(props)` | Chamado pelo `unmount` do vitral. Erro vai para o `onError` do host |
| `update(props)` (parcels) | Chamado pelo `update` do vitral. Sem `update`, o app é desmontado e montado com as props novas |
| Lifecycles em sequência | Um `mount` espera o `unmount` anterior terminar |

Duas instâncias montadas ao mesmo tempo recebem `name` diferentes (`conta`, `conta-2`), porque os adaptadores do single-spa guardam o estado por `name`.

## Limites

- `props.singleSpa`, `props.mountParcel` e `navigateToUrl` só existem num host single-spa. Use `ctx.navigate` e `<Remote>`.
- Para tirar o single-spa do bundle, troque o embrulho pelo adaptador do framework (`reactRemote(Root)`, `vueRemote(App)`). Veja [Migrar do single-spa](/migracao/single-spa).
