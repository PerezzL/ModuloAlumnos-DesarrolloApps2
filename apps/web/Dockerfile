# Se construye desde la raíz: docker build -f apps/web/Dockerfile .
# Las VITE_* quedan fijas en el build: el navegador solo conoce la URL del Gateway (y, con
# VITE_AUTH_PROXY=true, su propio origen para login, refresh y logout).
FROM node:24-alpine AS build
ARG VITE_GATEWAY_URL=http://localhost:4000
ARG VITE_NOTIFICATIONS_URL=http://localhost:4000/notifications
ARG VITE_BIBLIOTECA_URL=https://asignia.app/uade-net
ARG VITE_EVENTOS_URL=https://eventos.uadenet.example
ARG VITE_AUTH_PROXY=false
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_NOTIFICATIONS_URL=$VITE_NOTIFICATIONS_URL \
    VITE_BIBLIOTECA_URL=$VITE_BIBLIOTECA_URL \
    VITE_EVENTOS_URL=$VITE_EVENTOS_URL \
    VITE_AUTH_PROXY=$VITE_AUTH_PROXY
WORKDIR /app
COPY . .
RUN npm ci && npm run gen && npm run build -w @uadenet/web

FROM nginx:1.29-alpine
# La imagen de nginx completa las plantillas de /etc/nginx/templates al arrancar.
# PORT: el que asigne el hosting. CORE_URL: a dónde se reenvía /api/v1/auth/ (sin "/" final);
# nginx resuelve el host al arrancar, así que tiene que existir aunque no se use el reenvío.
ENV PORT=80 \
    CORE_URL=http://localhost:4000
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
