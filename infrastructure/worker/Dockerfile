FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker ./worker
RUN mkdir -p /data /artifacts && chown node:node /data /artifacts

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

USER node
EXPOSE 8787
CMD ["node", "worker/server.mjs"]
