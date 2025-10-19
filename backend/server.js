const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { connectDB } = require('./config/database');
const { logger } = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// 連接資料庫（可選，如果資料庫不可用則跳過）
let dbConnected = false;
connectDB().then(connected => {
  dbConnected = connected;
  if (connected) {
    logger.info('資料庫已連接');
  } else {
    logger.warn('資料庫未連接，部分功能可能不可用');
  }
}).catch(error => {
  logger.warn('資料庫連接失敗，將在無資料庫模式下運行:', error.message);
});

// 安全中間件
app.use(helmet());

// CORS配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: '請求過於頻繁，請稍後再試'
  }
});
app.use(limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 日誌中間件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// 路由
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404處理
app.use('*', (req, res) => {
  res.status(404).json({ error: '找不到請求的資源' });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: '服務器內部錯誤',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// 啟動服務器
app.listen(PORT, () => {
  logger.info(`服務器運行在端口 ${PORT}`);
  console.log(`🚀 服務器已啟動: http://localhost:${PORT}`);
});

// 優雅關閉
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信號，正在關閉服務器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信號，正在關閉服務器...');
  process.exit(0);
});