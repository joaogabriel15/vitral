# vitral com Docker

Um host React (`loja`) e dois remotes, um React (`carrinho`) e um Vue (`busca`), cada um no próprio contêiner.

```bash
docker compose up --build
```

Abra http://localhost:8080.

## Como funciona

| Contêiner | O que faz |
| --- | --- |
| `carrinho`, `busca` | `vite build` na primeira etapa. Na segunda, nginx serve o `dist` com `vitral.json` sem cache e o resto com cache longo |
| `loja` | nginx serve o host e repassa `/mf/<remote>/` para o contêiner do remote. Ao subir, escreve `/remotes.json` a partir de `VITRAL_REMOTES` |

O host chama `configure({ remotes: '/remotes.json' })`. Nenhuma URL de remote entra no build do host, então a mesma imagem serve em desenvolvimento, homologação e produção: muda só a variável.

Tudo fica na mesma origem (`localhost:8080`), então não precisa de CORS.

## Remote fora do ar

```bash
docker compose stop carrinho
```

Recarregue a página. A busca continua funcionando, e no lugar do carrinho aparece o botão "Carrinho indisponível. Tentar de novo". O nginx resolve o nome do remote a cada pedido, por isso o host sobe mesmo com um remote parado.

## Deploy de um remote

```bash
docker compose up --build -d carrinho
```

Só o carrinho é reconstruído. O host não muda e mostra a versão nova na próxima visita.

## Remotes em outra origem

Se os remotes ficam num CDN ou em outro domínio, aponte `VITRAL_REMOTES` para as URLs completas e libere a origem do host no remote:

```yaml
loja:
  environment:
    VITRAL_REMOTES: '{"carrinho":"https://carrinho.empresa.com/vitral.json"}'
carrinho:
  environment:
    ALLOWED_ORIGIN: https://loja.empresa.com
```

## Kubernetes

As mesmas imagens funcionam com um Deployment e um Service por remote. O Ingress pode repassar `/mf/carrinho/` para o Service `carrinho`, no lugar do nginx do host. `VITRAL_REMOTES` vem de um ConfigMap.

## Rodar local, sem Docker

```bash
cd carrinho && npm install && npm run dev   # porta 5174
cd busca && npm install && npm run dev      # porta 5175
cd loja && npm install && npm run dev       # porta 3000
```

Em desenvolvimento, o host lê `loja/public/remotes.json`, que aponta para as portas 5174 e 5175. Editar um remote atualiza a página sem recarregar.
