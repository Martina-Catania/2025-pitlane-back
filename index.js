require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const app = express();
const PORT = process.env.PORT || 3005;

const routes = require('./routes');
const { initializePrismaMiddleware } = require('./config/prismaClient');

// Configure CORS to allow requests from the frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://localhost:3000',
  'https://127.0.0.1:3000'
];

// Add environment-specific origins
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // For production/deployment, be more permissive
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow any localhost or 127.0.0.1 origin for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Vercel deployments
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // If none of the above, allow it anyway (for now)
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use('/', routes);

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Health check endpoint with diagnostic information
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Add a test endpoint without authentication
app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS test successful!', 
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Start voting session scheduler
  const votingLib = require('./controllers/votingLib');
  votingLib.startVotingSessionScheduler();
  console.log('✅ Voting session scheduler started');

  httpServer.listen(PORT, () => {
    console.log('='.repeat(70));
    console.log('🚀 QueComemos Backend Server Started Successfully');
    console.log('='.repeat(70));
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`⚙️  Voting Scheduler: Active`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log('='.repeat(70));
  });
}

// Export app and server for testing
module.exports = { app, httpServer };
