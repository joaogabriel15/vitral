# Local e Docker

Como rodar host e remotes na sua máquina e em contêineres. O exemplo completo está em [`examples/docker`](https://github.com/joaogabriel15/vitral/tree/main/examples/docker): um host React (`loja`) e dois remotes, um React (`carrinho`) e um Vue (`busca`).

## Local, sem Docker

Cada remote roda no próprio `vite dev`, numa porta:

```bash
cd carrinho && npm install && npm run dev   # vite --port 5174
cd busca && npm install && npm run dev      # vite --port 5175
cd loja && npm install && npm run dev       # vite --port 3000
```

O host lê a lista de remotes de um arquivo:

```js
// loja/src/main.jsx
configure({ remotes: '/remotes.json' })
```

```json
// loja/public/remotes.json
{
  "carrinho": "http://localhost:5174/vitral.json",
  "busca": "http://localhost:5175/vitral.json"
}
```

Editar um remote atualiza o host sem recarregar a página. Para rodar só um remote local e pegar os outros de homologação, abra o host com `?vitral=carrinho@http://localhost:5174`. Veja [Desenvolvimento e HMR](./desenvolvimento).

## Docker

```bash
docker compose up --build
```

Abra `http://localhost:8080`.

```yaml
# compose.yaml
services:
  loja:
    build: ./loja
    ports:
      - "8080:80"
    environment:
      VITRAL_REMOTES: '{"carrinho":"/mf/carrinho/vitral.json","busca":"/mf/busca/vitral.json"}'
  carrinho:
    build: ./carrinho
  busca:
    build: ./busca
```

### Como funciona

| Contêiner | O que faz |
| --- | --- |
| `carrinho`, `busca` | `vite build` na primeira etapa. Na segunda, nginx serve o `dist` com `vitral.json` sem cache e o resto com cache longo |
| `loja` | nginx serve o host e repassa `/mf/<remote>/` para o contêiner do remote. Ao subir, escreve `/remotes.json` a partir de `VITRAL_REMOTES` |

O host chama `configure({ remotes: '/remotes.json' })`. Nenhuma URL de remote entra no build do host, então a mesma imagem serve em desenvolvimento, homologação e produção: muda só a variável.

Tudo fica na mesma origem (`localhost:8080`), então não precisa de CORS.

### Remote fora do ar

```bash
docker compose stop carrinho
```

Recarregue a página. A busca continua funcionando, e no lugar do carrinho aparece o botão "Carrinho indisponível. Tentar de novo". O nginx resolve o nome do remote a cada pedido, por isso o host sobe mesmo com um remote parado.

### Deploy de um remote

```bash
docker compose up --build -d carrinho
```

Só o carrinho é reconstruído. O host não muda e mostra a versão nova na próxima visita.

### Remotes em outra origem

Se os remotes ficam num CDN ou em outro domínio, aponte `VITRAL_REMOTES` para as URLs completas e libere a origem do host no remote:

```yaml
loja:
  environment:
    VITRAL_REMOTES: '{"carrinho":"https://carrinho.empresa.com/vitral.json"}'
carrinho:
  environment:
    ALLOWED_ORIGIN: https://loja.empresa.com
```

### Kubernetes

As mesmas imagens funcionam com um Deployment e um Service por remote. O Ingress pode repassar `/mf/carrinho/` para o Service `carrinho`, no lugar do nginx do host. `VITRAL_REMOTES` vem de um ConfigMap.

## Arquivos

Dockerfile de um remote:

```dockerfile
# 1. Build do remote: gera dist/ com vitral.json, JS e CSS.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Serve dist/ com nginx. Nenhum Node em produção.
FROM nginx:1.27-alpine
# Origem que pode baixar este remote. Em produção, use a origem do host.
ENV ALLOWED_ORIGIN="*"
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
```

nginx do host:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  gzip on;
  gzip_types application/javascript text/css application/json;

  # DNS do Docker. Resolver o nome a cada pedido deixa o host subir
  # mesmo com um remote fora do ar: só aquele remote mostra erro.
  resolver 127.0.0.11 valid=10s;

  # Mesma origem do host: sem CORS e sem porta extra exposta.
  location /mf/carrinho/ {
    set $remote http://carrinho;
    rewrite ^/mf/carrinho/(.*)$ /$1 break;
    proxy_pass $remote;
  }
  location /mf/busca/ {
    set $remote http://busca;
    rewrite ^/mf/busca/(.*)$ /$1 break;
    proxy_pass $remote;
  }

  location = /remotes.json {
    add_header Cache-Control "no-cache" always;
  }
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  }
  location / {
    try_files $uri /index.html;
  }
}
```
