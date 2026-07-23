# From the server directory:
#   docker build -t fibbelous-server .
#   docker run --rm -p 8080:8080 -v fibbelous-data:/app/.data fibbelous-server

FROM rust:1-bookworm AS builder

WORKDIR /app

COPY Cargo.toml ./
COPY src ./src

RUN cargo build --release \
    && strip target/release/server

FROM debian:bookworm-slim AS runtime

# CARGO_MANIFEST_DIR is baked in at compile time as /app
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.data/workspaces

COPY --from=builder /app/target/release/server /usr/local/bin/fibbelous-server

ENV SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8080 \
    RUST_LOG=server=info,jsonrpsee=info

EXPOSE 8080

VOLUME ["/app/.data"]

CMD ["fibbelous-server"]
