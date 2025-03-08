# Simple development Dockerfile
FROM node:18-alpine

# Set up working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy application files
COPY . .

# Install dependencies and build
RUN npm install && npm run build

# Set environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Kolkata

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/images/generated

# Start the application
CMD ["node", "dist/main.js"] 