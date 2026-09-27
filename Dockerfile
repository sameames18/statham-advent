# Stathmas: one Node process, no npm dependencies, SQLite database on /data.
# Pinned to a Node 22 minor that satisfies "engines" in package.json (>=22.13).
FROM node:22.22-slim

ENV NODE_ENV=production \
    PORT=4747 \
    DB_FILE=/data/stathmas.db

WORKDIR /app
COPY package.json ./
COPY server/ ./server/
COPY public/ ./public/
# So a deployed calendar can be redrawn before December from inside the container:
#   docker compose exec stathmas node scripts/reshuffle.js 2026
COPY scripts/reshuffle.js ./scripts/

# The database is the only state. It lives on a volume so it outlives the
# container. /data is handed to the unprivileged `node` user (uid 1000) that
# the official image ships, and a named volume copies that ownership on first
# use; a bind mount must be made writable by uid 1000 yourself.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node
EXPOSE 4747

# The image has neither curl nor wget, so the check is a one-line Node script.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
