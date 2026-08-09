/**
 * local server entry file, for local development
 * Updated to use PORT from .env
 */
import app from './app.ts';
import { initializeDatabase } from './config/database.ts';
import { initializeOpenAIConfig } from './routes/openai.ts';
import { initializeGeminiConfig } from './routes/gemini.ts';
import { initializeIlmuConfig } from './routes/ilmu.ts';
import { initializeWasapmaticConfig } from './routes/wasapmatic.ts';
import { startWhatsAppQueue } from './services/messageQueueService.ts';
import { startAuditRetentionJob } from './services/retentionService.ts';
import { startTaskReminderJob } from './services/taskReminderService.ts';

/**
 * Initialize database and start server
 */
async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    // Initialize AI service configurations from database
    await Promise.allSettled([
      initializeOpenAIConfig(),
      initializeGeminiConfig(),
      initializeIlmuConfig(),
      initializeWasapmaticConfig()
    ]);
    console.log('✅ AI service configurations initialized');
    startWhatsAppQueue();
    console.log('✅ WhatsApp queue processor started');
    startTaskReminderJob();
    console.log('✅ Task reminder job started (setiap 5 minit)');
    startAuditRetentionJob();
    console.log('✅ Audit retention job (90 hari) started');
    
    // Start server
    const parsedPort = Number(process.env.PORT);
    const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3005;
    const HOST = process.env.SERVER_HOST || 'localhost';
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Server ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;




