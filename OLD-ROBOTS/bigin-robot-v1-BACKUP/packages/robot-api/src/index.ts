/**
 * Robot API Server
 *
 * REST API for the distributed AI model robots
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import biginRoutes from './routes/bigin';
import { errorHandler } from './middleware/errorHandler';
import type { ApiResponse } from './types/api';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.ROBOT_API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'Robot API is running',
    data: {
      version: '0.1.0',
      endpoints: {
        bigin: '/bigin/*',
        health: '/health'
      }
    }
  };
  res.json(response);
});

app.get('/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  };
  res.json(response);
});

// Robot routes
app.use('/bigin', biginRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   🤖 ROBOT API - Modelo IA Distribuida    ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`📖 API Documentation:`);
    console.log(`   GET  /              - API info`);
    console.log(`   GET  /health        - Health check`);
    console.log(`   GET  /bigin/health  - Bigin robot status`);
    console.log(`   POST /bigin/create-order - Create order`);
    console.log(`   POST /bigin/find-lead    - Find lead`);
    console.log(`   POST /bigin/create-lead  - Create lead`);
    console.log(`   POST /bigin/add-note     - Add note`);
    console.log(`   POST /bigin/logout       - Logout\n`);
    console.log('✅ Ready to receive requests!\n');
  });
}

export default app;
