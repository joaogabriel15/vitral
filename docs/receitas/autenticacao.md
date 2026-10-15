# Login e usuário

O host mantém o login e a sessão. O remote recebe o usuário e as operações de que precisa. O backend continua responsável por autorizar cada requisição.

## No host

Neste exemplo, `sessao` é o serviço de autenticação que sua aplicação já usa:

```jsx
import { Remote } from 'vitral/react'

export function AreaEmployee({ sessao }) {
  if (!sessao.usuario) return <p>Entre para acessar esta área.</p>

  return (
    <Remote
      name="employee"
      props={{
        usuario: sessao.usuario,
        sair: () => sessao.logout(),
      }}
      fallback={<p>Carregando…</p>}
    />
  )
}
```

Ao sair, atualize o estado de sessão do host para desmontar a área protegida. O vitral não implementa login nem renovação de token.

## No remote

```jsx
import { reactRemote } from 'vitral/react'

function EmployeeApp({ usuario, sair }) {
  return (
    <section>
      <p>Olá, {usuario.nome}</p>
      <button onClick={sair}>Sair</button>
    </section>
  )
}

export default reactRemote(EmployeeApp)
```

## E as chamadas à API?

- Com cookie `HttpOnly`, o remote pode usar a sessão sem receber um token por props.
- Se a API exige Bearer token, o host pode passar uma função `getToken()` que retorna um token válido; o remote a chama antes da requisição.
- Um caminho como `/api/pedidos` é relativo à origem do **host**, não à CDN do remote.
- Não publique tokens no barramento de eventos nem persista credenciais no remote.

Para várias áreas acompanharem o mesmo usuário, veja [Estado compartilhado](/contexto). Passar funções organiza a integração, mas não cria uma barreira contra código malicioso: confira [Segurança](/guia/seguranca).
