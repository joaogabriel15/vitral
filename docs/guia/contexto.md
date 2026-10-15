# Comunicação e contexto

Comece passando props. Use eventos para avisos entre áreas e estado compartilhado quando várias áreas precisam acompanhar o mesmo valor.

| Necessidade | Use |
| --- | --- |
| Passar usuário ou uma função do host ao remote | Props |
| Avisar que um item foi adicionado | Eventos |
| Compartilhar tema ou sessão atual | `provide` e `shared` |
| Abrir uma página de outra área | `navigate` |

## Props

```jsx
<Remote name="produtos" props={{ usuario, aoSelecionar: (id) => abrirProduto(id) }} />
```

O remote recebe essas props no componente exportado. Elas são atualizadas sem remontar a área.

No `<vitral-remote>`, o atributo `props` aceita JSON. Para funções, use a propriedade JavaScript `elemento.props`.

## Eventos

```ts
import { events } from 'vitral'

const parar = events.on('carrinho:total', (total) => console.log(total))
events.emit('carrinho:total', 120)
parar() // encerre a assinatura quando ela não for mais necessária
```

O `events.on()` global exige limpeza manual. Dentro do remote, assinaturas via `ctx.events` são encerradas no unmount. Os hooks também cuidam da limpeza:

```jsx
import { useEventValue } from 'vitral/react'

export function Total() {
  const total = useEventValue('carrinho:total')
  return <span>{total ?? 0}</span>
}
```

O barramento global compartilhado requer versões do vitral com suporte ao protocolo global; a versão 0.1.0 não o implementa. Para remotes antigos, use o barramento fornecido em `ctx.events`.

## Estado compartilhado

O host cria o valor:

```ts
import { provide } from 'vitral'

const tema = provide('tema', 'claro', { writable: false })
```

Uma área React acompanha as mudanças:

```jsx
import { useShared } from 'vitral/react'

export function TemaAtual() {
  const tema = useShared('tema')
  return <span>{tema}</span>
}
```

Consulte [Estado compartilhado](/contexto) para atualizar valores, declarar tipos e usar outros frameworks. A permissão de escrita organiza a API; não é uma barreira de segurança contra JavaScript malicioso na página.

## Navegação

```ts
import { navigate } from 'vitral'

navigate('/employee/123')
```

Para URLs da mesma origem, o vitral muda o histórico e sinaliza `popstate`. O roteador do host precisa estar integrado para montar a área correta. URLs de outra origem fazem uma navegação completa.

Veja [Rotas entre aplicações](/receitas/rotas) e [Login e usuário](/receitas/autenticacao).
