# Conectar projetos existentes

Cada repositório pode expor sua aplicação inteira por um `vitral.json`. O principal monta essa aplicação dentro do próprio layout.

Este exemplo usa dois projetos existentes com React e Vite. Para outros frameworks, consulte [Host](./host) e [Remote](./remote).

## 1. Prepare o repo de produtos

Instale o vitral:

```bash
npm install vitral
```

Crie uma entrada que exporte a aplicação. `ProdutosApp` deve incluir as páginas e os providers de que a área precisa:

```jsx
// src/remote.jsx
import { reactRemote } from 'vitral/react'
import ProdutosApp from './ProdutosApp'
import './index.css'

export default reactRemote(ProdutosApp)
```

Essa entrada não chama `createRoot`: o adaptador cuida da montagem. Os providers do React no host não atravessam automaticamente para a raiz do remote.

Crie uma configuração separada para preservar o build atual da aplicação:

```js
// vite.remote.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [react(), vitral({ name: 'produtos', entry: 'src/remote.jsx' })],
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist-remote' },
})
```

Se o projeto usa aliases ou outros plugins, inclua os necessários nessa configuração também.

Para desenvolver e gerar o remote, respectivamente:

```bash
npx vite --config vite.remote.config.js
npx vite build --config vite.remote.config.js
```

## 2. Conecte o principal

Instale `vitral` no repo principal e registre a URL uma vez, na inicialização do cliente:

```js
// src/remotes.js
import { configure } from 'vitral'

configure({
  remotes: {
    produtos: 'http://localhost:5174/vitral.json',
  },
})
```

Importe esse arquivo antes de renderizar a aplicação, por exemplo no `src/main.jsx`. Na área em que produtos deve aparecer:

```jsx
import { Remote } from 'vitral/react'

export function AreaProdutos({ usuario }) {
  return (
    <Remote
      name="produtos"
      props={{ usuario }}
      fallback={<p>Carregando produtos…</p>}
      error={(erro, retry) => <button onClick={retry}>Tentar novamente</button>}
    />
  )
}
```

Abra o principal com os dois servidores rodando. Ele deve mostrar produtos dentro do seu layout.

## E os outros repositórios?

Repita a entrada e o build para cada aplicação, mudando o nome, o componente e a porta de desenvolvimento. Por exemplo, employee pode rodar na porta `5175`.

| Repositório | Entrada | URL local |
| --- | --- | --- |
| Produtos | `reactRemote(ProdutosApp)` | `http://localhost:5174/vitral.json` |
| Employee | `reactRemote(EmployeeApp)` | `http://localhost:5175/vitral.json` |

Adicione cada URL ao mapa do principal. Não é preciso registrar cada página interna.

Próximo passo: [Rotas entre aplicações](/receitas/rotas). Para produção, veja [Publicar](./publicacao).
