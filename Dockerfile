# Email Template QA System - Docker Build
# Multi-stage build for optimal image size

# ================================
# Stage 1: Build the React application
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./web/
COPY test_framework/package*.json ./test_framework/

# Install dependencies
WORKDIR /app/web
RUN npm ci --production=false

WORKDIR /app/test_framework
RUN npm ci

# Copy source code
WORKDIR /app
COPY web ./web
COPY test_framework ./test_framework
COPY email_templates ./email_templates
COPY test_reports ./test_reports

# Build the React application
WORKDIR /app/web
RUN npm run build

# ================================
# Stage 2: Production image
# ================================
FROM node:20-slim AS production

# Install required packages for Chromium
RUN apt-get update && apt-get install -y \
    tini \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set Playwright to use system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy built assets and server files
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/web/package*.json ./web/
COPY --from=builder /app/web/vite.config.js ./web/
COPY --from=builder /app/web/server.js ./web/
COPY --from=builder /app/test_framework ./test_framework
COPY --from=builder /app/email_templates ./email_templates
COPY --from=builder /app/test_reports ./test_reports

# Install production dependencies
WORKDIR /app/web
RUN npm ci --production

WORKDIR /app/test_framework
RUN npm ci --production

WORKDIR /app

# Create necessary directories
RUN mkdir -p test_reports web/artifacts web/logs test_framework/output/test-plans

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Use tini as init system (installed to /usr/bin on Debian-based images)
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the application
CMD ["node", "web/server.js"]
