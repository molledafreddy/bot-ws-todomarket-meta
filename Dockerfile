# Railway Dockerfile - Simplified version for debugging
FROM node:18-alpine AS base

# Set timezone to Santiago, Chile
ENV TZ=America/Santiago
RUN apk add --no-cache tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# Build stage
FROM base as builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy source and build
COPY . .
COPY package*.json *-lock.yaml ./

# Install build dependencies and build
RUN apk add --no-cache --virtual .build-deps \
        python3 \
        make \
        g++ \
        git \
    && pnpm install \
    && pnpm run build \
    && apk del .build-deps

# Production stage
FROM base as production
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json /app/*-lock.yaml ./

# Install only production dependencies
RUN npm cache clean --force && \
    pnpm install --production --frozen-lockfile --ignore-scripts && \
    rm -rf ~/.npm ~/.cache /tmp/*

# Create logs directory with proper permissions (use /tmp for Railway compatibility)
RUN mkdir -p /tmp/logs && \
    chmod 777 /tmp/logs && \
    ln -sf /tmp/logs /app/logs && \
    echo "Log directories configured" > /tmp/logs/setup.log

# Give nodejs user ownership of /app directory
RUN chown -R nodejs:nodejs /app

# Create startup script with logging
RUN echo '#!/bin/sh\n\
echo "🚀 Starting TodoMarket Bot..."\n\
echo "📊 Environment:"\n\
echo "  - NODE_ENV: $NODE_ENV"\n\
echo "  - TZ: $TZ"\n\
echo "  - PORT: ${PORT:-3008}"\n\
echo "  - PWD: $(pwd)"\n\
echo "  - USER: $(whoami)"\n\
echo "📂 Files check:"\n\
ls -la /app/dist/ || echo "❌ No dist directory"\n\
echo "📝 Permissions check:"\n\
ls -la /app/logs/ 2>/dev/null || echo "Creating logs directory..."\n\
mkdir -p /app/logs 2>/dev/null || true\n\
touch /app/logs/app.log 2>/dev/null || true\n\
echo "🔥 Starting application..."\n\
exec node dist/app.js\n\
' > /app/start.sh && chmod +x /app/start.sh && chown nodejs:nodejs /app/start.sh

# Verify files are in place
RUN echo "📦 Verifying build artifacts:" && \
    ls -la /app/ && \
    ls -la /app/dist/ && \
    echo "✅ Build verification complete"

# Switch to non-root user
USER nodejs

# Expose port (Railway will set PORT env var)  
EXPOSE 3008

# Start application with detailed logging
CMD ["/app/start.sh"]
