import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'http';
import app from '../src/app.js';
import { getSanitizedConfig, closePool } from '../src/config/db.js';

describe('HackTrack Backend — Milestone 1 Tests', () => {
  let server;
  let baseUrl;

  // Start server on an ephemeral random port for tests
  test.before((t, done) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  test.after(async () => {
    await closePool();
    await new Promise((resolve) => server.close(resolve));
  });

  // Helper function to perform HTTP requests without external libraries
  function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = request.request(
        url,
        {
          method: options.method || 'GET',
          headers: options.headers || {},
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            try {
              const json = body ? JSON.parse(body) : null;
              resolve({ status: res.statusCode, headers: res.headers, body: json });
            } catch {
              resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
            }
          });
        }
      );
      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  it('1. Root endpoint GET / returns 200 and API metadata', async () => {
    const res = await makeRequest('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'HackTrack API');
    assert.equal(res.body.healthCheck, '/api/v1/health');
  });

  it('2. Health check GET /api/v1/health returns structured status and sanitized services', async () => {
    const res = await makeRequest('/api/v1/health');
    // Status will be 200 (if MySQL is running & authenticated) or 503 (if unauthenticated/unreachable)
    assert.ok(res.status === 200 || res.status === 503);
    assert.ok(res.body.status === 'healthy' || res.body.status === 'degraded');
    assert.ok(res.body.services);
    assert.equal(res.body.services.api.status, 'online');
    assert.equal(res.body.services.database.dialect, 'mysql');
  });

  it('3. Security verification: database password is never exposed in health check or config', async () => {
    const res = await makeRequest('/api/v1/health');

    // Ensure no password field exists
    assert.equal(res.body.services.database.config.password, undefined);
    assert.equal('password' in res.body.services.database.config, false);

    // Also test getSanitizedConfig directly
    const sanitized = getSanitizedConfig();
    assert.equal('password' in sanitized, false);
    assert.equal(sanitized.password, undefined);
  });

  it('4. CORS verification: origin http://localhost:5174 is granted access', async () => {
    const res = await makeRequest('/api/v1/health', {
      headers: { Origin: 'http://localhost:5174' },
    });
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5174');
  });

  it('5. CORS preflight OPTIONS request returns 204 with allowed headers & methods', async () => {
    const res = await makeRequest('/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5174',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5174');
    assert.ok(res.headers['access-control-allow-methods'].includes('GET'));
  });

  it('6. Unknown endpoint returns standardized 404 JSON response', async () => {
    const res = await makeRequest('/api/v1/non-existent-endpoint');
    assert.equal(res.status, 404);
    assert.equal(res.body.status, 404);
    assert.equal(res.body.error, 'Not Found');
  });
});
