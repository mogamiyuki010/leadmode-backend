const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

// 創建郵件傳輸器
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// 發送歡迎郵件
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"樊登聽書" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '🎉 歡迎領取《主角模式》免費聽書版！',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>歡迎領取《主角模式》</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fbbf24, #f97316); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: linear-gradient(135deg, #fbbf24, #f97316); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature { display: flex; align-items: center; margin: 10px 0; }
            .feature-icon { width: 24px; height: 24px; margin-right: 10px; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 恭喜您成功領取！</h1>
              <p>親愛的 ${name}，歡迎加入樊登聽書大家庭！</p>
            </div>
            
            <div class="content">
              <h2>📚 《主角模式》免費聽書版</h2>
              <p>您已成功領取樊登老師親自導讀的《主角模式》聽書版，總時長8小時的精華內容，完全免費！</p>
              
              <div class="features">
                <h3>🎯 聽書特色</h3>
                <div class="feature">
                  <span class="feature-icon">🎧</span>
                  <span>樊登老師親自導讀，專業解析</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">⏰</span>
                  <span>8小時精華內容，節省時間</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">📱</span>
                  <span>多平台收聽，隨時隨地學習</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">💾</span>
                  <span>支援離線下載，無網路也能聽</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">🔄</span>
                  <span>終身有效，可反覆收聽</span>
                </div>
              </div>
              
              <a href="#" class="button">立即開始收聽</a>
              
              <h3>📖 關於《主角模式》</h3>
              <p>這本書將教您如何從被動的人生觀眾，轉變為主動的人生主角。透過系統性的思維框架和實踐方法，幫助您建立主角意識，實現真正的人生自主。</p>
            </div>
            
            <div class="footer">
              <p>如有任何問題，請聯繫我們：service@fandeng-audio.com</p>
              <p>© 2025 樊登聽書. 保留所有權利。</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('歡迎郵件發送成功:', { email, messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error('發送歡迎郵件失敗:', { email, error: error.message });
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail
};