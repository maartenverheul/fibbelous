# From the server directory (compose) or repository root:
#   docker compose -f server/docker-compose.yml build
#   docker build -f server/Dockerfile -t fibbelous-server .

FROM node:22-bookworm AS client-builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY device/package.json ./device/
COPY server/package.json ./server/

RUN npm ci

COPY client ./client
RUN npm run build -w client

FROM rust:1-bookworm AS builder

WORKDIR /app

COPY server/Cargo.toml ./
COPY server/src ./src

RUN cargo build --release \
    && strip target/release/server

FROM debian:bookworm-slim AS runtime

# CARGO_MANIFEST_DIR is baked in at compile time as /app
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.data/workspaces /app/wwwroot

COPY --from=builder /app/target/release/server /usr/local/bin/fibbelous-server
COPY --from=client-builder /app/client/dist /app/wwwroot

ENV SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8080 \
    RUST_LOG=server=info,jsonrpsee=info

EXPOSE 8080

VOLUME ["/app/.data"]

CMD ["fibbelous-server"]
