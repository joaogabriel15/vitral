# Canary e rollback

Publica a versão nova de um remote para uma parte dos usuários e volta para a anterior sem build do host e sem serviço externo. Tudo fica em arquivos estáticos no seu CDN.

## Como funciona

- Cada versão é publicada na própria pasta e nunca muda depois.
- Um arquivo-ponteiro, o canal, diz qual versão é a estável e qual é a canary.
- O host baixa o canal, escolhe a versão do usuário e segue pelo `vitral.json` dela.
- Voltar uma versão é editar o canal.

```
https://cdn.empresa.com/checkout/
  canal.json
  1.4.0/vitral.json, remote-[hash].js, ...
  1.5.0/vitral.json, remote-[hash].js, ...
```

## 1. Publicar cada versão na própria pasta

No remote, ligue `versionDir`. O build sai em `dist/<versão>/`, com a `version` do `package.json`:

```js
// vite.config.js do remote
vitral({ versionDir: true })
```

Envie `dist/` para o CDN sem apagar as pastas das versões anteriores. Os arquivos de uma pasta de versão podem ter cache eterno, inclusive o `vitral.json` dela.

## 2. Escrever o canal

```json
{ "stable": "1.4.0", "canary": { "version": "1.5.0", "percent": 10 } }
```

| Campo | O que faz |
| --- | --- |
| `stable` | Versão de quem não está na canary |
| `canary.version` | Versão nova |
| `canary.percent` | Parte dos usuários que recebe a canary, de 0 a 100 |

Uma versão como `"1.5.0"` vira `1.5.0/vitral.json`, ao lado do canal. Também vale um caminho (`"./beta/vitral.json"`) ou uma URL completa de um `vitral.json`.

O canal muda a cada lançamento: sirva com `Cache-Control: no-cache`, como o `vitral.json` de sempre.

## 3. Apontar o host para o canal

Registre a URL do canal no lugar da URL do `vitral.json`:

```ts
configure({
  remotes: { checkout: 'https://cdn.empresa.com/checkout/canal.json' },
})
```

O host reconhece o canal pelo campo `stable`. Nada mais muda: `fallback`, contrato, SRI e `onError` funcionam como antes, com o `vitral.json` da versão escolhida.

## Quem recebe a canary

Cada usuário tem um número de 0 a 99 por remote, o `bucket`. Quem tem `bucket < percent` recebe a canary. O número é sempre o mesmo para o mesmo usuário, então ele não troca de versão a cada carga. Subir `percent` de 10 para 50 mantém na canary quem já estava.

Por padrão, o número sai de um id aleatório guardado no `localStorage` do navegador. Para o mesmo usuário ter a mesma versão em todos os aparelhos, passe uma chave dele:

```ts
configure({ canaryKey: usuario.id })
```

## Regra própria: cookie, grupo de teste, query

`resolve` escolhe a versão. Recebe o canal e `{ name, bucket }`, e devolve a versão (ou a URL de um `vitral.json`). Devolver `undefined` usa a regra padrão.

```ts
configure({
  remotes: {
    checkout: {
      url: 'https://cdn.empresa.com/checkout/canal.json',
      // Quem tem o cookie beta=1 recebe a canary; os outros seguem o percent.
      resolve: (canal) => (document.cookie.includes('beta=1') ? canal.canary?.version : undefined),
    },
  },
})
```

O canal aceita campos próprios, que o `resolve` lê:

```json
{ "stable": "1.4.0", "interno": "1.6.0-rc.1" }
```

```ts
resolve: (canal) => (usuario.funcionario ? (canal.interno as string) : undefined)
```

## Rollback automático

Quando a versão escolhida não é a estável, o host conta os erros dela: falha de download, `CONTRACT_MISMATCH`, erro no `mount`, `ctx.reportError` e, com `captureGlobalErrors`, os erros sem tratamento atribuídos ao remote. São os mesmos erros que chegam ao `onError` do `configure`.

Com 3 erros numa janela de 20 montagens, o host:

1. volta para a estável até o fim da sessão da aba (fica no `sessionStorage`);
2. troca as montagens na tela pela estável, com as props atuais;
3. chama `onRollback`.

```ts
configure({
  remotes: {
    checkout: { url: 'https://cdn.empresa.com/checkout/canal.json', rollback: { errors: 3, mounts: 20 } },
  },
  onRollback: ({ name, from, to, errors, mounts }) => {
    analytics.track('rollback', { name, from, to, errors, mounts })
  },
})
```

| Campo de `rollback` | Padrão | O que faz |
| --- | --- | --- |
| `errors` | `3` | Erros que disparam o rollback |
| `mounts` | `20` | Tamanho da janela, em montagens. A contagem de erros recomeça a cada janela |

`rollback: false` desliga. O rollback vale só para aquele navegador. Para tirar a canary de todo mundo, edite o canal.

Se o canal publicar outra canary (ex.: `1.5.1`), ela é tentada de novo, mesmo na sessão que abandonou a `1.5.0`.

## Voltar uma versão para todos

Edite o canal:

```json
{ "stable": "1.4.0" }
```

A próxima carga de cada página já usa a `1.4.0`. Páginas abertas veem a mudança com [`watchUpdates()`](./atualizacoes), porque o canal é conferido como um `vitral.json`.

Para promover a canary, troque `stable` para `"1.5.0"` e tire `canary`.

## Observações

- O `integrity` e o `manifest` embutido da entrada do host não valem para canais: a integridade vem do `vitral.json` de cada versão.
- O canal e as versões passam pela mesma regra de [origens](./seguranca). Versões numa origem diferente da do canal precisam estar em `allowedOrigins`.
- O código do canal fica num arquivo à parte (cerca de 1 kB), baixado só quando o host encontra um canal.
