import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger';
import { connectionRoutes, interfaceRoutes, ipRoutes, ipv6Routes, systemRoutes, dashboardRoutes, firewallRoutes, containerRoutes, aiRoutes, aiOpsRoutes } from './routes';
import { metricsCollector, scheduler, healthReportService, auditLogger, initializeInspectionHandler, alertEngine } from './services/ai-ops';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3099;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 设置 API 路由响应字符集为 UTF-8（仅对 /api 路由生效，不影响静态文件）
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/connection', connectionRoutes);
app.use('/api/interfaces', interfaceRoutes);
app.use('/api/ip', ipRoutes);
app.use('/api/ipv6', ipv6Routes);
app.use('/api/system', systemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/firewall', firewallRoutes);
app.use('/api/container', containerRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-ops', aiOpsRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Serve static files in production
if (isProduction) {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  
  // Handle SPA routing - serve index.html for all non-API routes
  app.get('*', (req: Request, res: Response) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // 404 handler for development
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });
}

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  
  // 初始化 AI-Ops 服务
  initializeAiOpsServices();
});

/**
 * 初始化 AI-Ops 智能运维服务
 * Requirements: 1.1, 4.1, 5.1
 */
async function initializeAiOpsServices(): Promise<void> {
  try {
    logger.info('Initializing AI-Ops services...');
    
    // 初始化审计日志服务（包含自动清理过期日志）
    await auditLogger.initialize();
    logger.info('AuditLogger initialized');
    
    // 初始化告警引擎
    await alertEngine.initialize();
    logger.info('AlertEngine initialized');
    
    // 注册告警评估回调到指标采集器
    // 每次采集完指标后自动评估告警规则
    metricsCollector.registerAlertEvaluationCallback(async (metrics) => {
      try {
        const triggeredAlerts = await alertEngine.evaluate(metrics);
        if (triggeredAlerts.length > 0) {
          logger.info(`Periodic alert evaluation triggered ${triggeredAlerts.length} alerts`);
        }
      } catch (error) {
        logger.error('Periodic alert evaluation failed:', error);
      }
    });
    logger.info('Alert evaluation callback registered to MetricsCollector');
    
    // 启动指标采集器
    await metricsCollector.start();
    logger.info('MetricsCollector started');
    
    // 注册健康报告生成任务处理器
    scheduler.registerHandler('health-report', async (task) => {
      const config = task.config || {};
      const { from, to, channelIds } = config as { from?: number; to?: number; channelIds?: string[] };
      const now = Date.now();
      const reportFrom = from || now - 24 * 60 * 60 * 1000; // 默认过去24小时
      const reportTo = to || now;
      
      if (channelIds && channelIds.length > 0) {
        return await healthReportService.generateAndSendReport(reportFrom, reportTo, channelIds);
      } else {
        return await healthReportService.generateReport(reportFrom, reportTo);
      }
    });
    logger.info('Health report handler registered');
    
    // 注册巡检任务处理器
    initializeInspectionHandler();
    logger.info('Inspection handler registered');
    
    // 启动调度器
    await scheduler.start();
    logger.info('Scheduler started');
    
    logger.info('AI-Ops services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AI-Ops services:', error);
  }
}

// 优雅停止处理
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // 停止 AI-Ops 服务
  try {
    logger.info('Stopping AI-Ops services...');
    await scheduler.stop();
    await metricsCollector.stop();
    auditLogger.stop();
    logger.info('AI-Ops services stopped');
  } catch (error) {
    logger.error('Error stopping AI-Ops services:', error);
  }
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server close:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });

  // 如果 10 秒内没有完成关闭，强制退出
  setTimeout(() => {
    logger.warn('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
};

// 监听终止信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
