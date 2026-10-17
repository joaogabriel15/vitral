# Seu primeiro remote

Um remote é um componente que o host baixa e monta em runtime.

## 1. Exporte o componente

Exporte o componente como `default`:

```jsx
// src/App.jsx
export default function Carrinho({ userId }) {
  return <p>Carrinho do usuário {userId}</p>
}
```

## 2. Adicione o plugin

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

O plugin descobre o framework pelos plugins do Vite e procura a entrada em `src/remote.*` ou `src/App.*`. Para outro arquivo, use `vitral({ entry: 'src/Carrinho.jsx' })`.

## 3. Gere o build

```bash
npx vite build
```

```
dist/
  remote-[hash].js
  remote-[hash].css
  vitral.json
```

`vitral.json` diz ao host qual JS e qual CSS baixar, com o hash de cada arquivo.

## 4. Publique

Publique a pasta `dist` em qualquer CDN com CORS liberado. Veja [Deploy](./deploy).

## Em desenvolvimento

```bash
npx vite --port 5174
```

`vite dev` serve um `vitral.json` em `http://localhost:5174/vitral.json`. O host recebe as mudanças sem recarregar. Veja [Desenvolvimento e HMR](./desenvolvimento).

::: tip Nota
O mesmo passo a passo vale para Vue, Svelte, Solid, Preact, Angular e Lit. Veja a página do seu [framework](/frameworks/react).
:::
