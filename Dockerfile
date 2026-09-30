FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY src/config ./src/config
COPY src/lib ./src/lib
COPY scripts/backup.js ./scripts/backup.js
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod +x /usr/local/bin/docker-entrypoint
ENV NODE_ENV=production HOST=0.0.0.0
EXPOSE 3001
ENTRYPOINT ["docker-entrypoint"]
CMD ["node", "server/index.js"]
