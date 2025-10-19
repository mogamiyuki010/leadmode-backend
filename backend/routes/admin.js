const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { logger } = require('../config/logger');

const router = express.Router();

// JWT認證中間件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '需要認證令牌' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: '無效的認證令牌' });
    }
    req.user = user;
    next();
  });
};

// 管理員登入
router.post('/login', [
  body('username').notEmpty().withMessage('用戶名不能為空'),
  body('password').isLength({ min: 6 }).withMessage('密碼至少6位')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // 查找管理員
    const admin = await query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (admin.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用戶名或密碼錯誤'
      });
    }

    const adminData = admin.rows[0];

    // 驗證密碼
    const isValidPassword = await bcrypt.compare(password, adminData.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用戶名或密碼錯誤'
      });
    }

    // 更新最後登入時間
    await query(
      'UPDATE admins SET last_login = $1 WHERE id = $2',
      [new Date(), adminData.id]
    );

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        id: adminData.id, 
        username: adminData.username,
        role: adminData.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('管理員登入成功:', { adminId: adminData.id, username });

    res.json({
      success: true,
      message: '登入成功',
      data: {
        token,
        admin: {
          id: adminData.id,
          username: adminData.username,
          role: adminData.role,
          lastLogin: adminData.last_login
        }
      }
    });

  } catch (error) {
    logger.error('管理員登入錯誤:', error);
    res.status(500).json({
      success: false,
      message: '登入失敗'
    });
  }
});

// 獲取用戶列表
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== 'all') {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // 獲取用戶列表
    const users = await query(`
      SELECT 
        u.id, u.name, u.email, u.created_at, u.updated_at, u.status,
        s.status as subscription_status, s.confirmed_at
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // 獲取總數
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('獲取用戶列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取用戶列表失敗'
    });
  }
});

// 獲取統計數據
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query;

    const stats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '${period} days' THEN 1 END) as users_this_period,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as users_this_week,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as users_today,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN status = 'banned' THEN 1 END) as banned_users
      FROM users
    `);

    // 獲取每日註冊趨勢
    const trends = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        trends: trends.rows
      }
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