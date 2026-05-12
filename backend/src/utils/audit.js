const { query } = require('../db');

async function auditLog(userId, action, entityType, entityId, req, metadata = {}) {
  try {
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0] || req?.ip;
    const userAgent = req?.headers?.['user-agent'];
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, action, entityType, entityId, ip || null, userAgent || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { auditLog };
