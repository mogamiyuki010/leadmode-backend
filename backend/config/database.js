const { Pool } = require('pg');
const { logger } = require('./logger');

// 資料庫連接配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fandeng_landing',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // 最大連接數
  idleTimeoutMillis: 30000, // 空閒連接超時
  connectionTimeoutMillis: 2000, // 連接超時
});

// 連接事件監聽
pool.on('connect', () => {
  logger.info('資料庫連接成功');
});

pool.on('error', (err) => {
  logger.error('資料庫連接錯誤:', err);
});

// 測試資料庫連接
const connectDB = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('資料庫連接測試成功');
  } catch (err) {
    logger.error('資料庫連接失敗:', err);
    process.exit(1);
  }
};

// 執行查詢的輔助函數
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('查詢執行時間:', { duration, text });
    return res;
  } catch (err) {
    logger.error('資料庫查詢錯誤:', { text, params, error: err.message });
    throw err;
  }
};

// 事務處理
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  connectDB,
  query,
  transaction
};