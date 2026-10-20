# 1. Build do host. Nenhuma URL de remote entra no build.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. nginx serve o host e repassa /mf/<remote>/ para o contêiner de cada remote.
FROM nginx:1.27-alpine
# Lista de remotes, escrita em /remotes.json quando o contêiner sobe.
ENV VITRAL_REMOTES='{"carrinho":"/mf/carrinho/vitral.json","busca":"/mf/busca/vitral.json"}'
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY remotes.sh /docker-entrypoint.d/40-remotes.sh
RUN chmod +x /docker-entrypoint.d/40-remotes.sh
COPY --from=build /app/dist /usr/share/nginx/html
