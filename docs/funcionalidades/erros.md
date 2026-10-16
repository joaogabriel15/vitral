# Tratamento de erros

Um remote que falha mostra o próprio erro. O resto da página continua funcionando.

## Quando usar

Em todo host: defina o que mostrar quando um remote falhar.

## Código

```jsx
<Remote
  name="carrinho"
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
  onError={(erro) => log(erro.code, erro.remote)}
/>
```

```html
<vitral-remote name="carrinho">
  <p slot="error">Indisponível</p>
</vitral-remote>
<script>
  document.querySelector('vitral-remote').addEventListener('vitral-error', (e) => log(e.detail.error.code))
</script>
```

Todo erro é um `RemoteError`:

| Campo | O que é |
| --- | --- |
| `code` | Código do erro. Veja a [lista](/erros/) |
| `remote` | Nome do remote |
| `docs` | Link da página do código, com causa e correção |

`retry` monta só aquele remote de novo.

## No remote

Em React e Vue, erros de render vão para o host. Nos outros, avise o host:

```ts
mount(el, props, ctx) {
  try {
    desenhar(el, props)
  } catch (erro) {
    ctx.reportError(erro)
  }
  return { unmount() {} }
}
```
