FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npm run build
EXPOSE 8090
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "8090", "--strictPort"]

