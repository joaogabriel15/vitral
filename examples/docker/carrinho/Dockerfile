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
