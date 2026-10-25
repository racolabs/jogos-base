# jogos-base não vai ao ar: a imagem só existe para provar que tipos e testes passam.
FROM node:26-alpine
WORKDIR /app
RUN npm install -g pnpm@10.28.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm typecheck && pnpm test
