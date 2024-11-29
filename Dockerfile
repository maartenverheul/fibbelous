# ============ BASE ============

FROM node:20-alpine AS base

WORKDIR /home/node/app

COPY package*.json ./
COPY web/package.json ./web/package.json
COPY server/package.json ./server/package.json

RUN ls
RUN ls web

RUN npm install --legacy-peer-deps


# ============ WEB ============

FROM base AS web

WORKDIR /home/node/app

COPY web ./web

RUN npm run build -w @fibbelous/web

# ============ SERVER ============

FROM base AS server

WORKDIR /home/node/app

COPY server ./server
COPY --from=web /home/node/app/web/dist ./web/dist

RUN npm run build -w @fibbelous/server

EXPOSE 3000

CMD ["npm", "start", "-w", "@fibbelous/server"]