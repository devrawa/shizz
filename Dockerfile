FROM golang:1.24-alpine AS go-build
WORKDIR /src
COPY workers/fetchguard/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /fetchguard .

FROM rust:1.85-alpine AS rust-build
WORKDIR /src
COPY workers/secretguard/ ./
RUN cargo build --release --locked

FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 shizz && useradd -u 10001 -g shizz -m shizz
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY backend/shizz/ /app/backend/shizz/
COPY --from=go-build /fetchguard /app/workers/bin/fetchguard
COPY --from=rust-build /src/target/release/secretguard /app/workers/bin/secretguard
USER 10001:10001
WORKDIR /app/backend
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "shizz.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers", "--no-access-log"]
