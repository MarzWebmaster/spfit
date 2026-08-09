import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * This is a API server
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database.ts';
import { rateLimit } from './middleware/auth.ts';
import authRoutes from './routes/auth.ts';
import userRoutes from './routes/users.ts';
import taskRoutes from './routes/tasks.ts';
import taskDoneRoutes from './routes/taskDone.ts';
import freelancerRoutes from './routes/freelancers.ts';
import notificationRoutes from './routes/notifications.ts';
import systemRoutes from './routes/system.ts';
import roleRoutes from './routes/roles.ts';
import wasapmaticRoutes from './routes/wasapmatic.ts';
import openaiRoutes from './routes/openai.ts';
import geminiRoutes from './routes/gemini.ts';
import ilmuRoutes from './routes/ilmu.ts';
import offersRoutes from './routes/offers.ts';
import auditRoutes from './routes/audit.ts';
import deliveryRoutes from './routes/delivery.ts';
import roleTypeRoutes from './routes/roleTypes.ts';
import mainConRoutes from './routes/mainCons.ts';
import paymentRoutes from './routes/payments.ts';
import taskSettingsRoutes from './routes/taskSettings.ts';
import projectRoutes from './routes/projects.ts';
import masterlistRoutes from './routes/masterlists.ts';
import assetRoutes from './routes/assets.ts';
import assetSettingRoutes from './routes/assetSettings.ts';
import assetUserRoutes from './routes/assetUsers.ts';
import aiTaskAssistantRoutes from './routes/aiTaskAssistant.ts';
import aiMasterlistAssistantRoutes from './routes/aiMasterlistAssistant.ts';
import taskRemindersRoutes from './routes/taskReminders.ts';
import assetReportRoutes from './routes/assetReports.ts';
import apiKeyRoutes from './routes/apikeys.ts';

const rootDir = process.cwd();

// load env from root directory
dotenv.config({ path: path.join(rootDir, '.env') });

// Database will be initialized in server.ts

const app: express.Application = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'https://spfit.marz.biz.my'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Security headers
app.use(helmet());
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());

// General API rate limit: 100 requests per 15 min per IP
const apiLimiter = rateLimit(100, 15 * 60 * 1000);
app.use('/api/', apiLimiter);

// Parse JSON and URL-encoded bodies BEFORE logging
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    console.log(`[${requestId}] ${new Date().toISOString()} - REQUEST ${req.method} ${req.path}`);
    const safeHeaders = { ...req.headers }; delete safeHeaders.authorization; delete safeHeaders.cookie; console.log(`[${requestId}] Headers:`, safeHeaders);
    console.log(`[${requestId}] Body:`, req.body);
    
    const originalSend = res.send;
    res.send = function(body) {
      console.log(`[${requestId}] ${new Date().toISOString()} - RESPONSE in ${Date.now() - start}ms`);
      console.log(`[${requestId}] Status:`, res.statusCode);
      console.log(`[${requestId}] Body:`, body);
      return originalSend.call(this, body);
    };
    
    next();
  });
}

// Serve static files for uploads
app.use('/uploads', express.static(path.join(rootDir, 'uploads')));

// Backup storage configuration
// IMPORTANT: BACKUP_PATH must be ABSOLUTE path
// Local dev (Windows): D:\SPFIT_Backups or absolute Windows path
// VPS/Production (Linux): /home/username/app/backups or /var/www/app/backups
import * as fs from 'fs';

const backupPath = process.env.BACKUP_PATH || path.join(__dirname, '../SPFIT_Backups');

// Ensure backup directory exists
try {
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
    console.log(`📁 Backup directory created at: ${backupPath}`);
  }
} catch (err) {
  console.warn(`⚠️ Warning: Could not ensure backup directory exists: ${err}`);
}

// Note: DO NOT expose full directory via express.static()
// Backup files must be accessed via secure endpoint: GET /api/system/backups/download/:fileName

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks-done', taskDoneRoutes);
app.use('/api/freelancers', freelancerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/wasapmatic', wasapmaticRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/ilmu', ilmuRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/role-types', roleTypeRoutes);
app.use('/api/main-cons', mainConRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/task-settings', taskSettingsRoutes);
app.use('/api/task-reminders', taskRemindersRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/masterlists', masterlistRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/asset-settings', assetSettingRoutes);
app.use('/api/asset-users', assetUserRoutes);
app.use('/api/ai-task-assistant', aiTaskAssistantRoutes);
app.use('/api/ai-masterlist-assistant', aiMasterlistAssistantRoutes);
app.use('/api/reports', assetReportRoutes);
app.use('/api/api-keys', apiKeyRoutes);

/**
 * health
 */
app.use('/api/health', (req: Request, res: Response, next: NextFunction): void => {
  res.status(200).json({
    success: true,
    message: 'ok'
  });
});

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', error);
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found'
  });
});

export default app;