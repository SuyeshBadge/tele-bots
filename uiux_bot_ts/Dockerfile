# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Kolkata

# Create app directory with proper permissions
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    mkdir -p /app/data /app/logs /app/images && \
    chown -R appuser:appgroup /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy necessary files
COPY --chown=appuser:appgroup .env.example ./
COPY --chown=appuser:appgroup images/ ./images/

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=1m --timeout=10s --start-period=30s --retries=3 \
  CMD node dist/scripts/health-check.js || exit 1

# Start the application
CMD ["node", "dist/main.js"] 