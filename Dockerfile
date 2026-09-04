# Сборка отделена от запуска: в готовый образ не попадают ни исходники
# фронтенда, ни инструменты сборки — только то, что нужно работающему
# приложению.

FROM node:22-alpine AS build
WORKDIR /app

# Зависимости ставятся до копирования кода: слой переиспользуется, пока
# не менялись package.json и lock-файл.
COPY package.json package-lock.json ./
COPY prisma ./prisma
# --ignore-scripts: postinstall лезет за .env, которого в сборке нет и не
# должно быть. Клиент Prisma генерируем явно следующей строкой.
RUN npm ci --ignore-scripts --no-audit --no-fund && npx prisma generate

COPY . .
RUN npm run build


FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4180

# Сервер выполняется как TypeScript через tsx, поэтому в образе нужны и
# исходники сервера, и зависимости целиком.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./
COPY docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data \
    && chown -R node:node /data /app

# Приложение не должно работать от root: файлы, которые оно пишет в
# /data, и так принадлежат обычному пользователю.
USER node

EXPOSE 4180
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
