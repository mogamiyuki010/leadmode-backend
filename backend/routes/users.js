const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { logger } = require('../config/logger');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

// 用戶註冊驗證規則
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('姓名長度必須在2-100字符之間'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('請提供有效的電子郵件地址')
];

// 用戶註冊
router.post('/register', registerValidation, async (req, res) => {
  try {
    // 驗證輸入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { name, email } = req.body;

    // 檢查email是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '此電子郵件已經註冊過'
      });
    }

    // 使用事務處理用戶註冊
    const result = await transaction(async (client) => {
      // 插入用戶
      const userResult = await client.query(
        `INSERT INTO users (name, email, source) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, email, created_at`,
        [name, email, 'landing_page']
      );

      const user = userResult.rows[0];

      // 創建訂閱記錄
      await client.query(
        `INSERT INTO subscriptions (user_id, subscription_type, status) 
         VALUES ($1, $2, $3)`,
        [user.id, 'free_book', 'pending']
      );

      // 記錄系統日誌
      await client.query(
        `INSERT INTO system_logs (action, user_id, details, ip_address, user_agent) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'user_registered',
          user.id,
          JSON.stringify({ name, email }),
          req.ip,
          req.get('User-Agent')
        ]
      );

      return user;
    });

    // 發送歡迎郵件
    try {
      await sendWelcomeEmail(email, name);
      
      // 更新訂閱狀態為已確認
      await query(
        'UPDATE subscriptions SET status = $1, confirmed_at = $2 WHERE user_id = $3',
        ['confirmed', new Date(), result.id]
      );
    } catch (emailError) {
      logger.error('發送歡迎郵件失敗:', emailError);
      // 郵件發送失敗不影響用戶註冊
    }

    logger.info('用戶註冊成功:', { userId: result.id, email });

    res.status(201).json({
      success: true,
      message: '註冊成功！我們已將下載連結發送到您的郵箱',
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        registeredAt: result.created_at
      }
    });

  } catch (error) {
    logger.error('用戶註冊錯誤:', error);
    res.status(500).json({
      success: false,
      message: '註冊失敗，請稍後再試'
    });
  }
});

// 獲取用戶統計（公開API）
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as users_this_week,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as users_today
      FROM users 
      WHERE status = 'active'
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    logger.error('獲取統計數據錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取統計數據失敗'
    });
  }
});

module.exports = router;