# vitral/vite

Plugin de build do remote. Gera o JS, o CSS com escopo e o `vitral.json`.

```ts
vitral(options?: VitralViteOptions): Plugin
```

## Uso

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/remote.tsx', dedupe: ['react'] })] }
```

## Opções

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `entry` | `src/remote.*` ou `src/App.*` | Arquivo cujo `export default` é o remote |
| `adapter` | descoberto pelos plugins do Vite | `react`, `vue`, `svelte`, `solid`, `preact`, `angular`, `element`, ou `false` |
| `name` | `name` do `package.json` | Nome no `vitral.json` |
| `version` | `version` do `package.json` | Versão no `vitral.json` |
| `scopeCss` | `true` | Prefixa o CSS |
| `theme` | nenhum | `'host'`. Veja [Estilos](/aprender/estilos) |
| `layers` | nenhum | `'flatten'`. Veja [Estilos](/aprender/estilos) |
| `renameRegisteredProperties` | `false` | Veja [Estilos](/aprender/estilos) |
| `exposes` | nenhum | Mapa `'./nome' → arquivo`. Veja [Exposes](/aprender/exposes) |
| `dedupe` | nenhum | Veja [Dedupe](/aprender/dedupe) |
| `types` | `true` | Gera `vitral.d.ts` |
| `contract` | nenhum | `{ version }`: versão do contrato no `vitral.json`. Veja [Contrato](/aprender/deploy#contrato-entre-host-e-remote) |
| `shared` | nenhum | Obsoleta. Use `dedupe` |

## Saída

```
dist/
  remote-[hash].js
  remote-[hash].css
  vitral.json
  vitral.d.ts
```

## Observações

- Um `export default` que já tem `mount` é usado como está.
- Em `vite dev`, serve um `vitral.json` de desenvolvimento, com CORS e sem SRI.
