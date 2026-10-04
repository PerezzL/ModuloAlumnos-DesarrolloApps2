# Se construye desde la raíz: docker build -f apps/web/Dockerfile .
# Las VITE_* quedan fijas en el build: el navegador solo conoce la URL del Gateway.
FROM node:24-alpine AS build
ARG VITE_GATEWAY_URL=http://localhost:4000
ARG VITE_NOTIFICATIONS_URL=http://localhost:4000/notifications
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_NOTIFICATIONS_URL=$VITE_NOTIFICATIONS_URL
WORKDIR /app
COPY . .
RUN npm ci && npm run gen && npm run build -w @uadenet/web

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
