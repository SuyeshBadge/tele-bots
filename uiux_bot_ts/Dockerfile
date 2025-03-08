# Use a simple production image
# Build stage
FROM node:18-alpine AS builder

# Set up build environment
WORKDIR /app
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Kolkata

# Create app directory with proper permissions
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    mkdir -p /app/data /app/logs /app/images/generated && \
    chown -R appuser:appgroup /app

# Copy package files and install production dependencies only
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copy pre-built application from builder stage
COPY --from=builder /app/dist/ ./dist/
COPY .env.example ./

# Ensure we can write to logs directory (not mounted as a volume)
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=1m --timeout=10s --start-period=30s --retries=3 \
  CMD node dist/scripts/health-check.js || exit 1

# Start the application
CMD ["node", "dist/main.js"] 