# Main container of the integration (Gladys sandbox: read-only rootfs, /data
# as the only writable path, no capability, 256 MB).
# Node 24 runs the TypeScript sources directly (type stripping): no build step.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY index.ts ./
COPY src ./src
COPY gladys-assistant-integration.json ./

ENV NODE_ENV=production
VOLUME ["/data"]

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.ts"]
