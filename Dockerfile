# Stage 1: Build & Run with Tor and Node.js
FROM node:20-alpine

# Install Tor, obfs4proxy, bash and procps
RUN apk update && apk add --no-cache tor bash curl procps

# Configure Tor
RUN echo "SocksPort 0.0.0.0:9050" > /etc/tor/torrc && \
    echo "ControlPort 0.0.0.0:9051" >> /etc/tor/torrc && \
    echo "CookieAuthentication 0" >> /etc/tor/torrc && \
    echo "HashedControlPassword \"\"" >> /etc/tor/torrc

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose Web Dashboard (3000) and Rotating Proxy Gateway (8899)
EXPOSE 3000
EXPOSE 8899

# Startup script to run both Tor and the Node.js application
RUN echo '#!/bin/bash' > /app/entrypoint.sh && \
    echo 'tor --runasdaemon 1' >> /app/entrypoint.sh && \
    echo 'sleep 2' >> /app/entrypoint.sh && \
    echo 'node server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
