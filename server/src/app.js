import './config/env.js';
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.js';

const app = express();

// Determine allowed origins (frontend development URL)
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5174',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic request logging for observability (without logging bodies to prevent secret leakage)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'HackTrack API',
    version: '1.0.0',
    description: 'Hackathon lifecycle management platform backend',
    healthCheck: '/api/v1/health',
  });
});

// Mount routes
app.use('/api/v1/health', healthRoutes);
// Convenience alias for health check
app.use('/health', healthRoutes);

// 404 Route Handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.originalUrl} does not exist on this server.`,
  });
});

// Centralized JSON Error Handler
app.use((err, req, res, _next) => {
  console.error(`[Error] ${err.name || 'ServerError'}: ${err.message}`);

  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      status: 403,
      error: 'CORS Forbidden',
      message: err.message,
    });
  }

  // Handle invalid JSON payload syntax
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Invalid JSON payload received',
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    status: statusCode,
    error: err.name || 'Internal Server Error',
    message: statusCode === 500 ? 'An unexpected server error occurred' : err.message,
  });
});

export default app;
