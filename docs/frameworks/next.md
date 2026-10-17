# Next.js

App Router e Pages Router. Import: `vitral/react`.

## Host

`<Remote>` já tem `'use client'`. No servidor ele renderiza o `fallback`. No cliente ele monta o remote. Não precisa de `dynamic(..., { ssr: false })`.

```tsx
// app/remotes.tsx
'use client'
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

if (typeof window !== 'undefined') {
  configure({ remotes: '/remotes.json' })
}

export function Carrinho({ userId }: { userId: number }) {
  return <Remote name="carrinho" props={{ userId }} fallback={<p>Carregando…</p>} />
}
```

```tsx
// app/page.tsx (componente de servidor)
import { Carrinho } from './remotes'

export default function Page() {
  return <main><Carrinho userId={42} /></main>
}
```

```json
// public/remotes.json
{ "carrinho": "https://cdn.empresa.com/carrinho/vitral.json" }
```

As props de `<Remote>` são as mesmas do [React](./react#host).

## Estado do servidor no cliente

Para mandar valores do [contexto compartilhado](/aprender/contexto) do servidor para o cliente, use `serializeShared`:

```tsx
import { serializeShared } from 'vitral'

<script
  type="application/json"
  data-vitral-shared
  dangerouslySetInnerHTML={{ __html: serializeShared({ usuario }) }}
/>
```

Veja [SSR](/aprender/ssr).

## Remote

Um remote não é um app Next. Crie o remote como um projeto [React](./react#remote) com Vite e use-o no host Next.
