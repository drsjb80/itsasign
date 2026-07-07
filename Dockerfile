FROM node:22-trixie-slim

# Add Raspberry Pi's apt repo, which carries a Chromium build patched/tested
# for Pi hardware (vanilla Debian's arm64 build crashes on launch on this SoC).
# The keyring is pulled from the signed .deb package rather than dearmoring
# raspberrypi.gpg.key directly: that raw export's self-certification still
# uses SHA-1, which trixie's apt signature policy now rejects.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL -o /tmp/rpi-keyring.deb http://archive.raspberrypi.com/debian/pool/main/r/raspberrypi-archive-keyring/raspberrypi-archive-keyring_2025.1+rpt1_all.deb \
    && dpkg-deb -x /tmp/rpi-keyring.deb /tmp/rpi-keyring-extract \
    && cp /tmp/rpi-keyring-extract/usr/share/keyrings/raspberrypi-archive-keyring.gpg /usr/share/keyrings/ \
    && rm -rf /tmp/rpi-keyring.deb /tmp/rpi-keyring-extract \
    && echo "deb [signed-by=/usr/share/keyrings/raspberrypi-archive-keyring.gpg] http://archive.raspberrypi.com/debian/ trixie main" > /etc/apt/sources.list.d/raspi.list

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
