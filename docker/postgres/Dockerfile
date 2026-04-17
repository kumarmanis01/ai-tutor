FROM postgres:15

# Install build dependencies and compile pgvector
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ca-certificates \
    postgresql-server-dev-15 \
  && git clone --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && cd /tmp/pgvector \
  && make && make install \
  && cd / \
  && rm -rf /tmp/pgvector \
  && apt-get remove -y git build-essential \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# Keep the default entrypoint from the upstream image
