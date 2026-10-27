# Dedupe de dependências

Faz o remote usar o React ou o Vue que já está na página, em vez de baixar outra cópia.

## Quando usar

Quando vários remotes usam o mesmo framework e você quer baixá-lo uma vez só. Sem `dedupe`, cada remote leva a própria cópia e nunca há conflito de versão.

## Código

```js
// vite.config.js do remote
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ dedupe: ['react'] })] }
```

- O remote usa a cópia da página quando a versão serve: `^` da versão instalada no remote.
- Quando não serve, ou não há cópia na página, baixa a própria.
- `<Remote>` de `vitral/react` oferece o React do host sem configuração.
- `['react']` cobre o grupo inteiro: `react`, `react-dom`, `react-dom/client` e o JSX runtime.

- `'pacote/*'` cobre o pacote e cada subpath do `exports` dele. Serve para um pacote publicado como código-fonte (uma biblioteca de componentes da empresa): os imports que chegam a um arquivo do pacote por alias ou `paths` do tsconfig também usam a cópia da página, se o arquivo sai por algum export dele. O build avisa os arquivos que não saem; esses ficam com cópia própria.

| Opção | Exemplo | O que faz |
| --- | --- | --- |
| `dedupe` | `['react']`, `['vue']`, `['@empresa/ui/*']` | Dependências que o remote pega da página quando a versão serve |
| `shared` (obsoleta) | `['react', 'react-dom/client']` | Tira do bundle e espera um import map no host. Prefira `dedupe` |

O host oferece outras dependências com `configure({ dedupe })`. Com uma função em `modules`, elas só são carregadas quando um remote pede, e não pesam no bundle inicial:

```ts
configure({
  dedupe: {
    i18next: { version: '25.1.0', modules: () => import('i18next').then((m) => ({ i18next: m })) },
  },
})
```

Num host Next, `share` do [`withVitral`](/frameworks/next#host-next-no-lugar-das-zonas) gera isso com as versões instaladas.
