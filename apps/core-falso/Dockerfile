# Solo para desarrollo y demo. Se construye desde la raíz: docker build -f apps/core-falso/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @uadenet/core-falso && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/core-falso/package.json ./apps/core-falso/package.json
COPY --from=build /app/apps/core-falso/dist ./apps/core-falso/dist
# Las fixtures se leen al responder: apps/core-falso/dist/../../../packages/fixtures
COPY --from=build /app/packages/fixtures ./packages/fixtures
USER node
EXPOSE 4000
CMD ["node", "apps/core-falso/dist/main.js"]
