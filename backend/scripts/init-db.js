const bcrypt = require('bcryptjs');
const { query, connectDB } = require('../config/database');
const { logger } = require('../config/logger');

// 初始化資料庫
const initDatabase = async () => {
  try {
    await connectDB();
    logger.info('開始初始化資料庫...');

    // 創建管理員用戶
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 檢查是否已有管理員
    const existingAdmin = await query('SELECT id FROM admins WHERE username = $1', ['admin']);
    
    if (existingAdmin.rows.length === 0) {
      await query(
        `INSERT INTO admins (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4)`,
        ['admin', process.env.ADMIN_EMAIL || 'admin@fandeng.com', hashedPassword, 'super_admin']
      );
      logger.info('管理員用戶創建成功');
    } else {
      logger.info('管理員用戶已存在');
    }

    // 創建必要的目錄
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logger.info('日誌目錄創建成功');
    }

    logger.info('資料庫初始化完成');
    console.log('✅ 資料庫初始化完成');
    console.log(`📧 管理員郵箱: ${process.env.ADMIN_EMAIL || 'admin@fandeng.com'}`);
    console.log(`🔑 管理員密碼: ${adminPassword}`);

  } catch (error) {
    logger.error('資料庫初始化失敗:', error);
    console.error('❌ 資料庫初始化失敗:', error.message);
    process.exit(1);
  }
};

// 如果直接運行此腳本
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
