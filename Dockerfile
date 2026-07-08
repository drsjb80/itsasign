FROM node:22-trixie-slim

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-common \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and fetch-proxy-server
COPY package*.json ./
COPY fetch-proxy-server.js ./

# Install dependencies, skip Puppeteer download
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev

# Expose Puppeteer server port
EXPOSE 3000

# Point Puppeteer to system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV RSS_SERVER_PORT=3000

# Start only the fetch-proxy/Puppeteer server
CMD ["node", "fetch-proxy-server.js"]
