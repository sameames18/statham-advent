# Stathmas: one Node process, no npm dependencies, nothing stored on disk.
# The calendar is worked out from CALENDAR_SECRET and each visitor's doors
# live in their own cookies, so the container has no state to keep.
# Pinned to a Node 22 minor that satisfies "engines" in package.json.
FROM node:22.22-slim

# TIME_TRAVEL=0 keeps preview mode off. That is already the default; it is set
# here too so the image stays safe whatever the code's default becomes.
# SITE_URL (the public address, for link previews) is set at run time.
ENV NODE_ENV=production \
    PORT=4747 \
    TIME_TRAVEL=0

WORKDIR /app
COPY package.json ./
COPY server/ ./server/
COPY public/ ./public/

USER node
EXPOSE 4747

# The image has neither curl nor wget, so the check is a one-line Node script.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Needs CALENDAR_SECRET at run time (see README.md); without it the server
# refuses to start. Preview mode stays off unless TIME_TRAVEL=1.
CMD ["node", "server/index.js"]
