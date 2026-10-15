# Segurança

Duas checagens rodam antes de executar o JS de um remote: a origem e o hash. As duas vêm ligadas.

## Origens permitidas

Sem `allowedOrigins`, a lib aceita a origem da página e as origens das URLs registradas em `configure({ remotes })`. Com `allowedOrigins`, só as da lista:

```ts
configure({
  allowedOrigins: ['https://cdn.empresa.com', 'https://static.parceiro.com'],
})
```

O `entry` do `vitral.json` também é conferido. Um manifesto em `cdn.empresa.com` não consegue apontar o JS para outra origem. URL fora da lista gera [`ORIGIN_BLOCKED`](/erros/ORIGIN_BLOCKED).

`['*']` libera tudo. Use só em desenvolvimento.

## Integridade (SRI)

O plugin grava o hash `sha384` do JS no `vitral.json`. Com hash, a lib:

1. baixa o JS com `fetch`;
2. calcula o hash sobre os bytes exatos da resposta;
3. compara com o esperado e, se não bater, para com [`INTEGRITY`](/erros/INTEGRITY);
4. executa exatamente os bytes conferidos, por uma URL `blob:`.

Aceita o formato SRI completo: `sha256`, `sha384` ou `sha512`, e vários hashes separados por espaço. Vale o algoritmo mais forte.

O manifesto vem do mesmo CDN que o JS. Para remote de terceiros, fixe o hash no host. O hash do host vence o do manifesto:

```ts
configure({
  remotes: {
    pagamento: { url: 'https://cdn.parceiro.com/pagamento/vitral.json', integrity: 'sha384-…' },
  },
})
```

Atualize o valor a cada deploy do remote.

## CSP

O JS conferido roda de uma URL `blob:`. Com Content Security Policy, inclua `blob:` em `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.empresa.com blob:
```

A lib baixa com `fetch` o `vitral.json`, o JS com hash e o CSS no Shadow DOM, então a origem do remote precisa estar em `connect-src`. No modo escopo o CSS entra por `<link>` e a origem precisa estar em `style-src`.

## O que não é isolado

- Shadow DOM isola o CSS, não o JS. O remote roda com os mesmos privilégios da página: lê cookies sem `HttpOnly`, `localStorage` e o DOM do host.
- Só carregue remotes de quem você confia como confia no próprio código.
- A lib não usa `eval` nem iframes. Ela guarda um único objeto global, em `Symbol.for('vitral')`.

## HTML no remote sem framework

Em `component()`, tudo que entra em `${}` passa por escape. `unsafeHTML(texto)` desliga o escape; use só com HTML que você gerou.

::: info Em breve
Isolamento por iframe com `sandbox`, para código de terceiros ou legado. SRI também no CSS.
:::
