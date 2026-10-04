# Se construye desde la raíz del monorepo: docker build -f apps/bff/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run gen && npm run build -w @uadenet/bff && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    OPENAPI_PATH=/app/openapi.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bff/package.json ./apps/bff/package.json
COPY --from=build /app/apps/bff/dist ./apps/bff/dist
# --chmod: el contenedor corre como `node` y el archivo puede venir con permisos 600
COPY --chmod=644 openapi.yaml ./openapi.yaml
USER node
EXPOSE 3000
CMD ["node", "apps/bff/dist/main.js"]
