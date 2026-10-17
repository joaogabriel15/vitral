# Começo rápido

Um **remote** é um componente publicado num CDN. O **host** é a página que mostra os remotes. O host só precisa da URL do `vitral.json` de cada remote.

## 1. Instale

```bash
npm install vitral
```

Instale no host e no remote. Para gerar os dois prontos:

```bash
npm create vitral@latest
```

## 2. Crie o remote

Exporte o componente como `default`:

```jsx
// src/App.jsx
export default function Carrinho({ userId }) {
  return <p>Carrinho do usuário {userId}</p>
}
```

Adicione o plugin no Vite:

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

O plugin descobre o framework pelos plugins do Vite e procura a entrada em `src/remote.*` ou `src/App.*`.

```bash
npx vite build
```

O build gera:

```
dist/
  remote-[hash].js
  remote-[hash].css
  vitral.json
```

Publique a pasta `dist` em qualquer CDN com CORS liberado.

## 3. Mostre no host

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})

export function App() {
  return (
    <Remote
      name="carrinho"
      props={{ userId: 42 }}
      fallback={<p>Carregando…</p>}
      error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
    />
  )
}
```

Mudar `props` atualiza o remote sem remontar.

## 4. Rode

Em desenvolvimento, rode o remote com `vite dev` e aponte o host para ele:

```bash
# no remote
npx vite --port 5174
```

```js
configure({ remotes: { carrinho: 'http://localhost:5174/vitral.json' } })
```

Editar o remote atualiza o host sem recarregar a página. Veja [Desenvolvimento](/funcionalidades/desenvolvimento).

## Sem build no host

Numa página HTML qualquer:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json"></vitral-remote>
```

## Próximos passos

- Seu framework: [React](/frameworks/react), [Next](/frameworks/next), [Vue](/frameworks/vue), [Nuxt](/frameworks/nuxt), [Angular](/frameworks/angular), [Svelte](/frameworks/svelte), [Solid](/frameworks/solid), [Preact](/frameworks/preact), [Lit](/frameworks/lit), [JS/TS puro](/frameworks/javascript).
- [Props e eventos](/funcionalidades/props-eventos) entre host e remotes.
- [Estilos e Tailwind](/funcionalidades/estilos).
