import './src/config/env.js';
import app from './src/app.js';
import { closePool } from './src/config/db.js';
import initDatabase from './src/database/initDb.js';
import store from './src/database/store.js';

const PORT = parseInt(process.env.PORT, 10) || 5050;
const HOST = process.env.HOST || '0.0.0.0';

// Bootstrap database connection and sync initial store
(async () => {
  try {
    await initDatabase();
    await store.loadFromDatabase();
  } catch (dbErr) {
    console.warn('⚠️ Non-fatal database bootstrap warning:', dbErr.message);
  }
})();

const server = app.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(`🚀 HackTrack Backend Server running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/v1/health`);
  console.log(`🌐 Allowed CORS Origin: ${process.env.CLIENT_ORIGIN || 'http://localhost:5174'}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

// Server-level error handling (e.g. port already in use)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`👉 You can configure a different port by setting PORT in server/.env (e.g., PORT=5051)`);
    console.error(`👉 Or terminate the conflicting process using: lsof -i :${PORT}\n`);
  } else {
    console.error(`\n❌ Server failed to start:`, err.message);
  }
  process.exit(1);
});

// Graceful shutdown handling
let isShuttingDown = false;

async function handleGracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Force shutdown after timeout in case connections remain active
  const forceExitTimeout = setTimeout(() => {
    console.error('⚠️  Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 5000);
  forceExitTimeout.unref();

  // Stop accepting new HTTP requests
  server.close(async (err) => {
    if (err) {
      console.error('Error closing HTTP server:', err.message);
    } else {
      console.log('✓ HTTP server closed to new connections.');
    }

    // Drain and close MySQL database connection pool
    try {
      await closePool();
      console.log('✓ MySQL connection pool safely terminated.');
    } catch (poolErr) {
      console.error('Error draining MySQL pool:', poolErr.message);
    }

    console.log('👋 HackTrack server shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

export default server;
