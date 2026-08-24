# Express API image for Cloud Run.
# Build from the repository root so shared/ is included:
#   docker build -f server/Dockerfile -t lunelle-api .
FROM node:22-bookworm-slim

WORKDIR /app/server

ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/src ./src
COPY shared /app/shared

USER node

EXPOSE 8080

CMD ["node", "src/index.js"]
