# Autenticação

O host faz o login e entrega aos remotes só o que eles precisam: o usuário e uma função que devolve o token. O remote nunca guarda o token.

## Host

```jsx
import { events } from 'vitral'
import { Remote } from 'vitral/react'

function App({ sessao }) {
  // Avisa todos os remotes quando o usuário muda.
  useEffect(() => events.emit('auth:usuario', sessao.usuario), [sessao.usuario])

  return (
    <Remote
      name="pedidos"
      props={{
        usuario: sessao.usuario,
        getToken: () => sessao.tokenAtual(), // renova sozinho no host
        sair: () => sessao.logout(),
      }}
    />
  )
}
```

## Remote

```jsx
export default reactRemote(function Pedidos({ usuario, getToken }) {
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    getToken()
      .then((token) => fetch('/api/pedidos', { headers: { Authorization: `Bearer ${token}` } }))
      .then((r) => r.json())
      .then(setPedidos)
  }, [usuario.id])

  return <Lista pedidos={pedidos} />
})
```

## Remote que não recebe props do host

Um remote dentro de outro remote não recebe as props do host. Ele lê o último usuário emitido e assina as mudanças:

```jsx
import { useEventValue } from 'vitral/react'

function Saudacao() {
  const usuario = useEventValue('auth:usuario')
  return usuario ? <p>Olá, {usuario.nome}</p> : null
}
```

`events.last('auth:usuario')` devolve o valor mesmo para quem montou depois do `emit`.

## Cuidados

- Não emita o token no barramento: qualquer código da página lê `events.last`.
- Prefira cookie `HttpOnly` quando a API está no mesmo domínio. Aí o remote só faz `fetch` com `credentials: 'include'`.
- Todo remote roda com os privilégios da página. Veja [Segurança](/guia/seguranca).

::: info Em breve
Estado compartilhado com dono e escrita controlada, para o host expor a sessão como um serviço.
:::
