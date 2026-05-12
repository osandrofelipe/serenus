const { query } = require('../db');

async function createNotification(userId, type, title, body, data = {}) {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)`,
      [userId, type, title, body, JSON.stringify(data)]
    );
  } catch (err) {
    console.error('Create notification error:', err.message);
  }
}

async function getUserNotifications(userId, limit = 20) {
  return query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
}

async function markAsRead(notificationId, userId) {
  return query(
    `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

module.exports = { createNotification, getUserNotifications, markAsRead };
