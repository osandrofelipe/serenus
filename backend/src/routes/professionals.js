const express = require('express');
const router = express.Router();
const { body, query: qv, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// GET /api/professionals - Listagem pública com filtros
router.get('/', async (req, res) => {
  const { specialty, city, home_service, min_price, max_price, min_rating, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = ["p.approval_status = 'approved'", "u.is_active = true"];

  if (specialty) {
    params.push(specialty);
    conditions.push(`$${params.length} = ANY(p.specialties)`);
  }
  if (city) {
    params.push(`%${city.toLowerCase()}%`);
    conditions.push(`LOWER(p.city) LIKE $${params.length}`);
  }
  if (home_service === 'true') conditions.push(`p.home_service = true`);
  if (min_price) { params.push(parseFloat(min_price)); conditions.push(`p.base_price >= $${params.length}`); }
  if (max_price) { params.push(parseFloat(max_price)); conditions.push(`p.base_price <= $${params.length}`); }
  if (min_rating) { params.push(parseFloat(min_rating)); conditions.push(`p.rating_avg >= $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(u.name || ' ' || u.surname) LIKE $${params.length} OR EXISTS (SELECT 1 FROM unnest(p.specialties) s WHERE LOWER(s) LIKE $${params.length}))`);
  }

  const where = conditions.join(' AND ');
  params.push(parseInt(limit), offset);

  try {
    const result = await query(`
      SELECT p.id, p.bio, p.specialties, p.experience_years, p.city, p.state,
             p.home_service, p.base_price, p.rating_avg, p.rating_count,
             p.plan, p.is_featured,
             u.name, u.surname, u.avatar_url
      FROM professionals p
      JOIN users u ON u.id = p.user_id
      WHERE ${where}
      ORDER BY p.is_featured DESC, p.rating_avg DESC, p.rating_count DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await query(`
      SELECT COUNT(*) FROM professionals p JOIN users u ON u.id = p.user_id WHERE ${where}
    `, params.slice(0, -2));

    res.json({
      professionals: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error('List professionals error:', err);
    res.status(500).json({ error: 'Erro ao buscar profissionais' });
  }
});

// GET /api/professionals/:id - Perfil público
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.id, p.bio, p.specialties, p.certifications, p.experience_years,
             p.city, p.state, p.home_service, p.base_price,
             p.rating_avg, p.rating_count, p.plan, p.is_featured, p.approval_status,
             u.name, u.surname, u.avatar_url, u.created_at as member_since
      FROM professionals p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND p.approval_status = 'approved' AND u.is_active = true
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Profissional não encontrado' });

    // Buscar serviços
    const services = await query(
      'SELECT id, name, description, duration_minutes, price, service_type FROM services WHERE professional_id = $1 AND is_active = true ORDER BY price',
      [req.params.id]
    );

    // Buscar avaliações públicas
    const reviews = await query(`
      SELECT r.id, r.rating, r.comment, r.professional_reply, r.created_at,
             u.name as client_name, u.avatar_url as client_avatar
      FROM reviews r
      JOIN users u ON u.id = r.client_id
      WHERE r.professional_id = $1 AND r.is_public = true
      ORDER BY r.created_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({
      ...result.rows[0],
      services: services.rows,
      reviews: reviews.rows,
    });
  } catch (err) {
    console.error('Get professional error:', err);
    res.status(500).json({ error: 'Erro ao buscar profissional' });
  }
});

// PUT /api/professionals/me - Profissional atualiza próprio perfil
router.put('/me', authenticate, authorize('professional'), [
  body('bio').optional().isLength({ max: 1000 }),
  body('base_price').optional().isFloat({ min: 1 }),
  body('specialties').optional().isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { bio, specialties, experience_years, city, state, home_service, base_price, certifications } = req.body;

  try {
    const result = await query(`
      UPDATE professionals SET
        bio = COALESCE($1, bio),
        specialties = COALESCE($2, specialties),
        experience_years = COALESCE($3, experience_years),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        home_service = COALESCE($6, home_service),
        base_price = COALESCE($7, base_price),
        certifications = COALESCE($8, certifications)
      WHERE user_id = $9 RETURNING id
    `, [bio, specialties, experience_years, city, state, home_service, base_price, certifications, req.user.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Perfil profissional não encontrado' });

    await auditLog(req.user.id, 'update_profile', 'professional', result.rows[0].id, req);
    res.json({ message: 'Perfil atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// GET /api/professionals/:id/availability - Slots disponíveis por data
router.get('/:id/availability', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Data obrigatória' });

  try {
    const dateObj = new Date(date);
    const weekday = dateObj.getDay();

    const avail = await query(
      `SELECT start_time, end_time, break_between_minutes FROM availability
       WHERE professional_id = $1 AND weekday = $2 AND is_active = true`,
      [req.params.id, weekday]
    );

    if (!avail.rows.length) return res.json({ slots: [] });

    // Buscar agendamentos existentes no dia
    const booked = await query(`
      SELECT scheduled_at, duration_minutes FROM bookings
      WHERE professional_id = $1
        AND DATE(scheduled_at AT TIME ZONE 'America/Fortaleza') = $2
        AND status IN ('confirmed','pending')
    `, [req.params.id, date]);

    const { start_time, end_time, break_between_minutes } = avail.rows[0];
    const slots = generateSlots(date, start_time, end_time, break_between_minutes, booked.rows);

    // Verificar bloqueios
    const blocked = await query(
      'SELECT 1 FROM availability_blocks WHERE professional_id = $1 AND blocked_date = $2',
      [req.params.id, date]
    );

    if (blocked.rows.length) return res.json({ slots: [], blocked: true });

    res.json({ slots });
  } catch (err) {
    console.error('Availability error:', err);
    res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
  }
});

function generateSlots(date, startTime, endTime, breakMin, bookedSlots) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let current = startH * 60 + startM;
  const end = endH * 60 + endM;

  while (current + 60 <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    const slotTime = `${date}T${h}:${m}:00`;

    const isBooked = bookedSlots.some(b => {
      const bStart = new Date(b.scheduled_at).getTime();
      const bEnd = bStart + b.duration_minutes * 60000;
      const sStart = new Date(slotTime).getTime();
      const sEnd = sStart + 60 * 60000;
      return sStart < bEnd && sEnd > bStart;
    });

    const isPast = new Date(slotTime) < new Date();

    slots.push({ time: `${h}:${m}`, datetime: slotTime, available: !isBooked && !isPast });
    current += 60 + parseInt(breakMin || 15);
  }

  return slots;
}

// ADMIN: GET /api/professionals/admin/pending
router.get('/admin/pending', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT p.id, p.bio, p.specialties, p.certifications, p.experience_years, p.city, p.base_price, p.created_at,
             u.id as user_id, u.name, u.surname, u.email, u.phone
      FROM professionals p
      JOIN users u ON u.id = p.user_id
      WHERE p.approval_status = 'pending'
      ORDER BY p.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pendências' });
  }
});

// ADMIN: POST /api/professionals/:id/approve
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    await query(
      `UPDATE professionals SET approval_status='approved', approved_at=NOW(), approved_by=$1, rejection_reason=NULL WHERE id=$2`,
      [req.user.id, req.params.id]
    );
    // TODO: enviar email de notificação ao profissional
    await auditLog(req.user.id, 'approve_professional', 'professional', req.params.id, req);
    res.json({ message: 'Profissional aprovado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao aprovar' });
  }
});

// ADMIN: POST /api/professionals/:id/reject
router.post('/:id/reject', authenticate, authorize('admin'), [
  body('reason').notEmpty().withMessage('Informe o motivo da rejeição'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    await query(
      `UPDATE professionals SET approval_status='rejected', rejection_reason=$1 WHERE id=$2`,
      [req.body.reason, req.params.id]
    );
    await auditLog(req.user.id, 'reject_professional', 'professional', req.params.id, req);
    res.json({ message: 'Profissional rejeitado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao rejeitar' });
  }
});

// PUT /api/professionals/:id/availability - Profissional atualiza disponibilidade
router.put('/me/availability', authenticate, authorize('professional'), async (req, res) => {
  const { availability } = req.body; // [{weekday, start_time, end_time, is_active, break_between_minutes}]
  if (!Array.isArray(availability)) return res.status(400).json({ error: 'Formato inválido' });

  try {
    const proResult = await query('SELECT id FROM professionals WHERE user_id = $1', [req.user.id]);
    if (!proResult.rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });

    const proId = proResult.rows[0].id;

    for (const slot of availability) {
      await query(`
        INSERT INTO availability (professional_id, weekday, start_time, end_time, break_between_minutes, is_active)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (professional_id, weekday) DO UPDATE SET
          start_time=$3, end_time=$4, break_between_minutes=$5, is_active=$6
      `, [proId, slot.weekday, slot.start_time, slot.end_time, slot.break_between_minutes || 15, slot.is_active !== false]);
    }

    res.json({ message: 'Disponibilidade atualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar disponibilidade' });
  }
});

module.exports = router;
