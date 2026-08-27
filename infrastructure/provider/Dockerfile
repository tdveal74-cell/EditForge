FROM node:20-bookworm-slim

WORKDIR /app
COPY provider ./provider
RUN mkdir -p /provider-artifacts && chown node:node /provider-artifacts

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9080

USER node
EXPOSE 9080
CMD ["node", "provider/server.mjs"]

