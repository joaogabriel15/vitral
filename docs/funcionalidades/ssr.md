# SSR

Os componentes de host funcionam em apps com renderização no servidor.

## Quando usar

Em Next, Nuxt, SvelteKit ou Angular SSR.

## O que acontece

- No servidor, o componente renderiza o `fallback`.
- No cliente, o remote monta. Não há erro de hidratação.
- No Next, `<Remote>` já tem `'use client'`.
- No Nuxt, chame `configure` num plugin `.client.ts`.
- No Angular, `provideVitral` não faz nada no servidor.

## Estado do servidor no cliente

No servidor, cada requisição tem o próprio [contexto compartilhado](./contexto). Para mandar os valores para o cliente:

```ts
import { serializeShared } from 'vitral'

const html = `<script type="application/json" data-vitral-shared>${serializeShared({ usuario })}</script>`
```

Coloque o script antes dos scripts do app. O primeiro `provide` da chave no cliente mantém o valor que veio do servidor. Funções e `undefined` ficam de fora.

| Função | O que faz |
| --- | --- |
| `serializeShared(valores)` | Transforma `{ chave: valor }` em JSON seguro para `<script>` |
