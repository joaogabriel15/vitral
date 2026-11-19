# Local and Docker

How to run host and remotes on your machine and in containers. The full example is in [`examples/docker`](https://github.com/joaogabriel15/vitral/tree/main/examples/docker): a React host (`loja`, the shop) and two remotes, a React one (`carrinho`, the cart) and a Vue one (`busca`, the search). The folder and remote names in the example are in Portuguese.

## Local, without Docker

Each remote runs in its own `vite dev`, on its own port:

```bash
cd carrinho && npm install && npm run dev   # vite --port 5174
cd busca && npm install && npm run dev      # vite --port 5175
cd loja && npm install && npm run dev       # vite --port 3000
```

The host reads the list of remotes from a file:

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

Editing a remote updates the host without reloading the page. To run only one remote locally and take the others from staging, open the host with `?vitral=carrinho@http://localhost:5174`. See [Development and HMR](./desenvolvimento).

## Docker

```bash
docker compose up --build
```

Open `http://localhost:8080`.

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

### How it works

| Container | What it does |
| --- | --- |
| `carrinho`, `busca` | `vite build` in the first stage. In the second, nginx serves `dist` with `vitral.json` uncached and the rest with a long cache |
| `loja` | nginx serves the host and proxies `/mf/<remote>/` to the remote's container. On start, it writes `/remotes.json` from `VITRAL_REMOTES` |

The host calls `configure({ remotes: '/remotes.json' })`. No remote URL goes into the host build, so the same image works in development, staging and production: only the variable changes.

Everything is on the same origin (`localhost:8080`), so no CORS is needed.

### A remote that is down

```bash
docker compose stop carrinho
```

Reload the page. The search keeps working, and in place of the cart a "Cart unavailable. Try again" button shows up. nginx resolves the remote's name on every request, which is why the host starts even with a remote stopped.

### Deploying one remote

```bash
docker compose up --build -d carrinho
```

Only the cart is rebuilt. The host doesn't change and shows the new version on the next visit.

### Remotes on another origin

If the remotes live on a CDN or another domain, point `VITRAL_REMOTES` to the full URLs and allow the host's origin in the remote:

```yaml
loja:
  environment:
    VITRAL_REMOTES: '{"carrinho":"https://cart.example.com/vitral.json"}'
carrinho:
  environment:
    ALLOWED_ORIGIN: https://shop.example.com
```

### Kubernetes

The same images work with one Deployment and one Service per remote. The Ingress can proxy `/mf/carrinho/` to the `carrinho` Service, instead of the host's nginx. `VITRAL_REMOTES` comes from a ConfigMap.

## Files

A remote's Dockerfile:

```dockerfile
# 1. Remote build: writes dist/ with vitral.json, JS and CSS.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Serve dist/ with nginx. No Node in production.
FROM nginx:1.27-alpine
# Origin allowed to download this remote. In production, use the host's origin.
ENV ALLOWED_ORIGIN="*"
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
```

Host nginx:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  gzip on;
  gzip_types application/javascript text/css application/json;

  # Docker DNS. Resolving the name on every request lets the host start
  # even with a remote down: only that remote shows an error.
  resolver 127.0.0.11 valid=10s;

  # Same origin as the host: no CORS and no extra port exposed.
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
