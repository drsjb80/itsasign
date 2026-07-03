FROM node:22-bookworm-slim

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-common \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and rss-server
COPY package*.json ./
COPY rss-server.js ./

# Install dependencies, skip Puppeteer download
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev

# Expose Puppeteer server port
EXPOSE 3000

# Point Puppeteer to system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV RSS_SERVER_PORT=3000

# Start only the RSS/Puppeteer server
CMD ["node", "rss-server.js"]
