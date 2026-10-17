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

| Opção | Exemplo | O que faz |
| --- | --- | --- |
| `dedupe` | `['react']`, `['vue']` | Dependências que o remote pega da página quando a versão serve |
| `shared` (obsoleta) | `['react', 'react-dom/client']` | Tira do bundle e espera um import map no host. Prefira `dedupe` |
