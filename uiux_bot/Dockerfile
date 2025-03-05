FROM python:3.9-slim

# Set environment variables
ENV PYTHONFAULTHANDLER=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PYTHONPATH=/app

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directory for persistent data and logs
RUN mkdir -p /app/data /app/data/logs /app/images/fallback

# Copy the application code
COPY . .

# Setup health check endpoint for Fly.io
RUN echo 'import http.server\nimport socketserver\n\nclass HealthCheckHandler(http.server.SimpleHTTPRequestHandler):\n    def do_GET(self):\n        if self.path == "/health":\n            self.send_response(200)\n            self.send_header("Content-type", "text/plain")\n            self.end_headers()\n            self.wfile.write(b"OK")\n        else:\n            self.send_response(404)\n            self.end_headers()\n\nHandler = HealthCheckHandler\nhttpd = socketserver.TCPServer(("", 8080), Handler)\n\nprint("Starting health check server on port 8080")\nhttpd.serve_forever()' > /app/health_check.py

# Set volume for persistent data
VOLUME ["/app/data", "/app/images"]

# Start both the health check server and the bot
CMD ["sh", "-c", "python health_check.py & python main.py"] 