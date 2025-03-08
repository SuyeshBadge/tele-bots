/**
 * Health HTTP Server for Fly.io
 * 
 * Provides HTTP endpoints for health checks and metrics
 * Required for proper monitoring and zero-downtime deployments on Fly.io
 */

import http from 'http';
import { getChildLogger } from '../utils/logger';
import { settings } from '../config/settings';

const logger = getChildLogger('health-server');

class HealthServer {
  private server: http.Server | null = null;
  private isHealthy: boolean = false;
  private startTime: number = Date.now();
  private botInstance: any | null = null;

  constructor() {
    logger.info('Initializing health server');
  }

  /**
   * Set the bot instance for metrics
   */
  setBotInstance(bot: any): void {
    this.botInstance = bot;
  }

  /**
   * Set the health status of the application
   */
  setHealthy(isHealthy: boolean): void {
    this.isHealthy = isHealthy;
  }

  /**
   * Start the HTTP server on the specified port
   */
  start(port: number = 8080): void {
    this.server = http.createServer((req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle OPTIONS requests for CORS
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Handle GET requests
      if (req.method === 'GET') {
        // Health check endpoint
        if (req.url === '/health') {
          if (this.isHealthy) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', uptime: this.getUptime() }));
          } else {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Service unavailable' }));
          }
          return;
        }

        // Metrics endpoint
        if (req.url === '/metrics') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            uptime: this.getUptime(),
            memory: process.memoryUsage(),
            subscribers: this.botInstance ? this.getSubscriberCount() : 'unknown',
            environment: settings.NODE_ENV
          }));
          return;
        }

        // Root endpoint
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('UI/UX Bot is running');
          return;
        }
      }

      // Not found for any other request
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    this.server.listen(port, () => {
      logger.info(`Health server listening on port ${port}`);
    });

    // Handle server errors
    this.server.on('error', (err) => {
      logger.error(`Health server error: ${err.message}`);
    });
  }

  /**
   * Stop the HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          logger.error(`Error stopping health server: ${err.message}`);
          reject(err);
        } else {
          logger.info('Health server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get subscriber count from bot instance
   */
  private getSubscriberCount(): number | string {
    try {
      // This will depend on how your bot tracks subscribers
      // Implement this based on your bot's structure
      if (this.botInstance && typeof this.botInstance.getSubscriberCount === 'function') {
        return this.botInstance.getSubscriberCount();
      }
      return 'unknown';
    } catch (error) {
      return 'error';
    }
  }
}

// Export a singleton instance
export const healthServer = new HealthServer(); 