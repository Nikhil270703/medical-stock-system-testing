const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Allowed Origins Configuration (Production, Testing, Local Dev)
const allowedOrigins = [
  'https://medical-stock-system.vercel.app',
  'https://medical-stock-system-testing.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3009'
];

// Append origins specified in Render / deployment environment variables if present
const envOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.ALLOWED_ORIGINS
].filter(Boolean);

envOrigins.forEach(envVal => {
  envVal.split(',').forEach(o => {
    const trimmed = o.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
});

// Dynamic Origin Validation Callback Compatible with Production & Testing
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (such as mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[cors] Blocked request from origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204
};

// CORS Middleware MUST execute BEFORE all routes & handlers
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security & Body Parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('tiny'));

// Root & Health Check Routes (with CORS enabled)
app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    message: 'Medical Stock System Backend API',
    module: 'result-analysis'
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    module: 'result-analysis'
  });
});

// API Routes (Mounted on '/' for direct frontend calls & '/result-analysis' for gateway compatibility)
app.use('/', routes);
app.use('/result-analysis', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found'
  });
});

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('[result-analysis]', err.message);

  res.status(err.status || 500).json({
    error: err.message || 'Server error'
  });
});

module.exports = app;