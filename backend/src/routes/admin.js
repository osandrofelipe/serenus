const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Todos os routes exigem admin
router.use(authenticate, authorize('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, pros, bookings, revenue] = await Promise.all([
      query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE role='client') clients, COUNT(*) FILTER (WHERE role='professional') professionals FROM users WHERE is_active=true`),
      query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE approval_status='pending') pending, COUNT(*) FILTER (WHERE approval_status='approved') approved FROM professionals`),
      query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='confirmed') confirmed, COUNT(*) FILTER (WHERE status='completed') completed, COUNT(*) FILTER (WHERE status LIKE 'cancelled%') cancelled FROM bookings`),
      query(`SELECT COALESCE(SUM(total_amount),0) gross, COALESCE(SUM(platform_fee),0) fees, COALESCE(SUM(professional_net),0) net FROM bookings WHERE status='completed'`),
    ]);

    res.json({
      users: users.rows[0],
      professionals: pros.rows[0],
      bookings: bookings.rows[0],
      revenue: revenue.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { role, search, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = [];

  if (role) { params.push(role); conditions.push(`role = $${params.length}`); }
  if (search) { params.push(`%${search.toLowerCase()}%`); conditions.push(`(LOWER(name||' '||surname) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  try {
    const result = await query(`
      SELECT id, name, surname, email, phone, role, is_active, email_verified, last_login, created_at
      FROM users ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// PATCH /api/admin/users/:id/suspend
router.patch('/users/:id/suspend', async (req, res) => {
  try {
    await query(
      'UPDATE users SET is_active = false WHERE id = $1 AND role != $2',
      [req.params.id, 'admin']
    );
    res.json({ message: 'Usuário suspenso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao suspender usuário' });
  }
});

// PATCH /api/admin/users/:id/activate
router.patch('/users/:id/activate', async (req, res) => {
  try {
    await query('UPDATE users SET is_active = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Usuário reativado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao reativar usuário' });
  }
});

// GET /api/admin/bookings - todas reservas com filtros
router.get('/bookings', async (req, res) => {
  const { status, date_from, date_to, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = [];

  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
  if (date_from) { params.push(date_from); conditions.push(`b.scheduled_at >= $${params.length}`); }
  if (date_to) { params.push(date_to); conditions.push(`b.scheduled_at <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  try {
    const result = await query(`
      SELECT b.id, b.status, b.scheduled_at, b.total_amount, b.platform_fee, b.professional_net,
             uc.name||' '||uc.surname as client_name, uc.email as client_email,
             up.name||' '||up.surname as pro_name,
             s.name as service_name
      FROM bookings b
      JOIN users uc ON uc.id = b.client_id
      JOIN professionals p ON p.id = b.professional_id
      JOIN users up ON up.id = p.user_id
      JOIN services s ON s.id = b.service_id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

// GET /api/admin/reviews - Avaliações para moderação
router.get('/reviews', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.id, r.rating, r.comment, r.is_public, r.is_flagged, r.created_at,
             uc.name as client_name, up.name as pro_name
      FROM reviews r
      JOIN users uc ON uc.id = r.client_id
      JOIN professionals p ON p.id = r.professional_id
      JOIN users up ON up.id = p.user_id
      ORDER BY r.is_flagged DESC, r.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
});

// GET /api/admin/audit-log
router.get('/audit-log', async (req, res) => {
  try {
    const result = await query(`
      SELECT a.*, u.email, u.name
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar audit log' });
  }
});

module.exports = router;
