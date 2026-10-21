import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, testConnection } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  const status = await testConnection();
  if (!status.connected) {
    console.log(`ℹ️ MySQL connection offline (${status.error || 'unreachable'}). Using fast in-memory store.`);
    return false;
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query("SHOW TABLES LIKE 'users'");
      if (rows.length === 0) {
        console.log('⚡ Initializing MySQL schema for hacktrack_db...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const sqlContent = fs.readFileSync(schemaPath, 'utf8');
          const statements = sqlContent
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !s.startsWith('--'));

          for (const statement of statements) {
            await connection.query(statement);
          }
          console.log('✓ MySQL schema executed successfully.');
        }
      } else {
        console.log('✓ MySQL tables verified in hacktrack_db.');
      }
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.warn('⚠️ Warning: Failed to execute schema.sql on MySQL:', err.message);
    return false;
  }
}

export default initDatabase;
