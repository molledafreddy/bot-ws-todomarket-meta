# Multi-stage optimized build for Railway deployment
FROM node:18-alpine AS base

# Set timezone to Santiago, Chile for Railway deployment
ENV TZ=America/Santiago
RUN apk add --no-cache tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# Build stage
FROM base as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY . .
COPY package*.json *-lock.yaml ./

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
        curl \
    && apk add --no-cache git \
    && pnpm install && pnpm run build \
    && apk del .gyp

# Production stage optimized for Railway
FROM base as deploy

WORKDIR /app

# Set production environment and timezone
ENV NODE_ENV=production
ENV TZ=America/Santiago

# Railway port configuration
ARG PORT
ENV PORT $PORT
EXPOSE $PORT

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application with proper ownership
COPY --from=builder --chown=nodejs:nodejs /app/assets ./assets
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/*.json /app/*-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

# Install production dependencies and clean up
RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp /tmp/* /var/cache/apk/*

# Switch to non-root user
USER nodejs

# Health check for Railway - Railway sets PORT automatically
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/ || exit 1

# Log timezone for verification
RUN echo "Container timezone: $(date)"

# Start command optimized for Railway
CMD ["npm", "start"]