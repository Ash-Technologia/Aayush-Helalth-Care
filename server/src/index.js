'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = parseInt(process.env.PORT || '5000', 10);

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  // Connect to MongoDB first — fail fast if DB is unreachable
  await connectDB();

  // Start the cleanup job for expired appointment locks
  // (loaded lazily so it only runs after DB is connected)
  try {
    require('./jobs/cleanupExpiredLocks');
    console.log('[Jobs] Cleanup job for expired locks initialized.');
  } catch (err) {
    console.warn(`[Jobs] Could not start cleanup job: ${err.message}`);
  }

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[Server] Aayush Health Care API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  // Railway sends SIGTERM before stopping the container.
  // We finish in-flight requests before closing.
  const shutdown = (signal) => {
    console.log(`\n[Server] ${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      console.log('[Server] MongoDB connection closed. Exiting.');
      process.exit(0);
    });

    // Force-kill if graceful shutdown takes too long (Railway gives ~10s)
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out. Force-exiting.');
      process.exit(1);
    }, 9000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Catch unhandled promise rejections — log and exit
  process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled promise rejection:', reason);
    shutdown('unhandledRejection');
  });

  // Catch uncaught exceptions — log and exit
  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught exception:', err);
    shutdown('uncaughtException');
  });
};

startServer();
