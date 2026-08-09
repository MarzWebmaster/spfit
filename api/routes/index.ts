import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import taskRoutes from './tasks';
import freelancerRoutes from './freelancers';
import notificationRoutes from './notifications';
import systemRoutes from './system';
import rolesRoutes from './roles';
import wasapmaticRoutes from './wasapmatic';
import openaiRoutes from './openai';
import geminiRoutes from './gemini';
import ilmuRoutes from './ilmu';
import offersRoutes from './offers';
import apiKeyRoutes from './apikeys';

const router = Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);
router.use('/freelancers', freelancerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/system', systemRoutes);
router.use('/roles', rolesRoutes);
router.use('/wasapmatic', wasapmaticRoutes);
router.use('/openai', openaiRoutes);
router.use('/gemini', geminiRoutes);
router.use('/ilmu', ilmuRoutes);
router.use('/offers', offersRoutes);
router.use('/api-keys', apiKeyRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SPFIT API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to SPFIT API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tasks: '/api/tasks',
      freelancers: '/api/freelancers',
      notifications: '/api/notifications',
      system: '/api/system'
    },
    documentation: {
      health: 'GET /api/health - Check API health status',
      auth: {
        login: 'POST /api/auth/login - User login',
        logout: 'POST /api/auth/logout - User logout',
        refresh: 'POST /api/auth/refresh - Refresh access token',
        profile: 'GET /api/auth/profile - Get user profile',
        'change-password': 'POST /api/auth/change-password - Change password'
      },
      users: {
        list: 'GET /api/users - Get all users',
        create: 'POST /api/users - Create new user',
        get: 'GET /api/users/:id - Get user by ID',
        update: 'PUT /api/users/:id - Update user',
        delete: 'DELETE /api/users/:id - Delete user'
      },
      tasks: {
        list: 'GET /api/tasks - Get all tasks',
        create: 'POST /api/tasks - Create new task',
        get: 'GET /api/tasks/:id - Get task by ID',
        update: 'PUT /api/tasks/:id - Update task',
        assign: 'PATCH /api/tasks/:id/assign - Assign task to freelancer',
        report: 'POST /api/tasks/:id/report - Submit task report',
        feedback: 'POST /api/tasks/:id/feedback - Submit task feedback'
      },
      freelancers: {
        list: 'GET /api/freelancers - Get all freelancers',
        profile: 'GET /api/freelancers/:id - Get freelancer profile',
        tasks: 'GET /api/freelancers/:id/tasks - Get freelancer tasks',
        apply: 'POST /api/freelancers/tasks/:taskId/apply - Apply for task',
        dashboard: 'GET /api/freelancers/:id/dashboard - Get freelancer dashboard'
      },
      notifications: {
        list: 'GET /api/notifications - Get user notifications',
        get: 'GET /api/notifications/:id - Get notification by ID',
        markRead: 'PATCH /api/notifications/:id/read - Mark as read',
        create: 'POST /api/notifications - Create notification',
        broadcast: 'POST /api/notifications/broadcast - Broadcast notification'
      },
      system: {
        dashboard: 'GET /api/system/dashboard - Get system dashboard',
        health: 'GET /api/system/health - Get system health',
        settings: 'GET /api/system/settings - Get system settings',
        logs: 'GET /api/system/activity-logs - Get activity logs'
      }
    }
  });
});

export default router;