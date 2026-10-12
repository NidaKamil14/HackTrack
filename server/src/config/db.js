import './env.js';
import mysql from 'mysql2/promise';

/**
 * Builds a connection pool configuration from environment variables.
 * Prioritizes socket connection if DB_SOCKET_PATH is specified,
 * otherwise connects via TCP (DB_HOST & DB_PORT).
 */
function createPoolConfig() {
  const config = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hacktrack_db',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    queueLimit: 0,
    connectTimeout: 4000,
  };

  if (process.env.DB_SOCKET_PATH) {
    config.socketPath = process.env.DB_SOCKET_PATH;
  } else {
    config.host = process.env.DB_HOST || '127.0.0.1';
    config.port = parseInt(process.env.DB_PORT, 10) || 3306;
  }

  return config;
}

const poolConfig = createPoolConfig();
export const pool = mysql.createPool(poolConfig);

/**
 * Returns safe diagnostic connection parameters (strictly omitting passwords).
 */
export function getSanitizedConfig() {
  return {
    host: poolConfig.host || 'localhost (socket)',
    port: poolConfig.port || (poolConfig.socketPath ? 'unix-socket' : 3306),
    user: poolConfig.user,
    database: poolConfig.database,
    socketPath: poolConfig.socketPath || null,
    connectionLimit: poolConfig.connectionLimit,
  };
}

/**
 * Tests MySQL connectivity by running a lightweight ping query.
 * Catches errors safely and returns a status object without crashing.
 */
export async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 AS health, NOW() AS server_time, VERSION() AS db_version');
    return {
      connected: true,
      serverTime: rows[0]?.server_time || null,
      dbVersion: rows[0]?.db_version || null,
    };
  } catch (err) {
    let safeMessage = 'Database connection failed';
    if (err.code === 'ECONNREFUSED') {
      safeMessage = 'MySQL server is not running or port is unreachable';
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      safeMessage = 'Authentication failed: Invalid database username or password';
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      safeMessage = `Database '${poolConfig.database}' does not exist`;
    } else if (err.code === 'ETIMEDOUT') {
      safeMessage = 'Database connection timed out';
    }

    return {
      connected: false,
      code: err.code || 'UNKNOWN_ERROR',
      error: safeMessage,
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Gracefully terminates all pool connections.
 */
export async function closePool() {
  try {
    await pool.end();
  } catch (err) {
    console.error('Error closing MySQL pool:', err.message);
  }
}
