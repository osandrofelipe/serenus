const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, getClient } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendBookingConfirmation, sendBookingCancellation } = require('../services/email');
const { createNotification } = require('../services/notifications');
const { auditLog } = require('../utils/audit');

const PLATFORM_FEE_PERCENT = 0.15;

// POST /api/bookings - Criar reserva
router.post('/', authenticate, authorize('client'), [
  body('professional_id').isUUID(),
  body('service_id').isUUID(),
  body('scheduled_at').isISO8601(),
  body('service_type').isIn(['local', 'home']),
  body('service_address').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { professional_id, service_id, scheduled_at, service_type, service_address, client_notes } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Verificar profissional aprovado
    const proResult = await client.query(
      `SELECT p.id, u.name as pro_name, u.email as pro_email
       FROM professionals p JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 AND p.approval_status = 'approved'`,
      [professional_id]
    );
    if (!proResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profissional não disponível' });
    }

    // Verificar serviço
    const serviceResult = await client.query(
      'SELECT id, name, duration_minutes, price FROM services WHERE id = $1 AND professional_id = $2 AND is_active = true',
      [service_id, professional_id]
    );
    if (!serviceResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const service = serviceResult.rows[0];
    const scheduledDate = new Date(scheduled_at);

    // Verificar se é futuro
    if (scheduledDate < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Data/hora deve ser no futuro' });
    }

    // Verificar disponibilidade (sem conflito)
    const conflict = await client.query(`
      SELECT id FROM bookings
      WHERE professional_id = $1
        AND status IN ('confirmed','pending')
        AND scheduled_at < $2::timestamptz + ($3 || ' minutes')::interval
        AND scheduled_at + (duration_minutes || ' minutes')::interval > $2::timestamptz
    `, [professional_id, scheduled_at, service.duration_minutes]);

    if (conflict.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Horário já reservado. Escolha outro horário.' });
    }

    // Verificar dias bloqueados
    const blocked = await client.query(
      `SELECT 1 FROM availability_blocks WHERE professional_id = $1 AND blocked_date = $2::date`,
      [professional_id, scheduled_at]
    );
    if (blocked.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Profissional indisponível nesta data' });
    }

    // Calcular valores
    const totalAmount = parseFloat(service.price);
    const platformFee = parseFloat((totalAmount * PLATFORM_FEE_PERCENT).toFixed(2));
    const professionalNet = parseFloat((totalAmount - platformFee).toFixed(2));

    // Criar booking
    const bookingResult = await client.query(`
      INSERT INTO bookings (
        client_id, professional_id, service_id, scheduled_at, duration_minutes,
        status, service_address, service_type, total_amount, platform_fee, professional_net, client_notes
      ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      req.user.id, professional_id, service_id, scheduled_at, service.duration_minutes,
      service_address || null, service_type, totalAmount, platformFee, professionalNet, client_notes || null
    ]);

    const booking = bookingResult.rows[0];

    // Criar registro de pagamento pendente
    await client.query(`
      INSERT INTO payments (booking_id, gateway, amount, platform_fee, professional_net, status, payment_method)
      VALUES ($1,'stripe',$2,$3,$4,'pending','card')
    `, [booking.id, totalAmount, platformFee, professionalNet]);

    await client.query('COMMIT');

    // Notificações (async, não bloqueia resposta)
    const pro = proResult.rows[0];
    const clientResult = await query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
    const clientUser = clientResult.rows[0];

    createNotification(professional_id, 'new_booking', 'Nova reserva!',
      `${clientUser.name} agendou ${service.name} para ${new Date(scheduled_at).toLocaleString('pt-BR')}`,
      { booking_id: booking.id }
    ).catch(console.error);

    sendBookingConfirmation(clientUser.email, clientUser.name, {
      proName: pro.pro_name, serviceName: service.name,
      scheduledAt: scheduledDate, totalAmount, bookingId: booking.id
    }).catch(console.error);

    await auditLog(req.user.id, 'create_booking', 'booking', booking.id, req);

    res.status(201).json({
      booking,
      message: 'Reserva criada! Aguardando confirmação de pagamento.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Erro ao criar reserva' });
  } finally {
    client.release();
  }
});

// GET /api/bookings - Listar reservas do usuário
router.get('/', authenticate, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let conditions = [];
    const params = [];

    if (req.user.role === 'client') {
      params.push(req.user.id);
      conditions.push(`b.client_id = $${params.length}`);
    } else if (req.user.role === 'professional') {
      const proResult = await query('SELECT id FROM professionals WHERE user_id = $1', [req.user.id]);
      if (!proResult.rows.length) return res.json({ bookings: [], total: 0 });
      params.push(proResult.rows[0].id);
      conditions.push(`b.professional_id = $${params.length}`);
    } else if (req.user.role === 'admin') {
      // admin vê tudo
    }

    if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit), offset);

    const result = await query(`
      SELECT b.*,
             uc.name as client_name, uc.surname as client_surname, uc.avatar_url as client_avatar,
             up.name as pro_name, up.surname as pro_surname,
             s.name as service_name, s.duration_minutes
      FROM bookings b
      JOIN users uc ON uc.id = b.client_id
      JOIN professionals p ON p.id = b.professional_id
      JOIN users up ON up.id = p.user_id
      JOIN services s ON s.id = b.service_id
      ${where}
      ORDER BY b.scheduled_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ bookings: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('List bookings error:', err);
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

// GET /api/bookings/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT b.*,
             uc.name as client_name, uc.surname as client_surname,
             up.name as pro_name, up.surname as pro_surname,
             s.name as service_name,
             py.status as payment_status, py.payment_method, py.paid_at
      FROM bookings b
      JOIN users uc ON uc.id = b.client_id
      JOIN professionals p ON p.id = b.professional_id
      JOIN users up ON up.id = p.user_id
      JOIN services s ON s.id = b.service_id
      LEFT JOIN payments py ON py.booking_id = b.id
      WHERE b.id = $1
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Reserva não encontrada' });

    const booking = result.rows[0];

    // Verificar permissão
    const proResult = await query('SELECT user_id FROM professionals WHERE id = $1', [booking.professional_id]);
    const isClient = booking.client_id === req.user.id;
    const isPro = proResult.rows[0]?.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isClient && !isPro && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar reserva' });
  }
});

// PATCH /api/bookings/:id/confirm - Profissional confirma
router.patch('/:id/confirm', authenticate, authorize('professional'), async (req, res) => {
  try {
    const proResult = await query('SELECT id FROM professionals WHERE user_id = $1', [req.user.id]);
    if (!proResult.rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });

    const result = await query(`
      UPDATE bookings SET status = 'confirmed'
      WHERE id = $1 AND professional_id = $2 AND status = 'pending'
      RETURNING *
    `, [req.params.id, proResult.rows[0].id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Reserva não encontrada ou já processada' });

    res.json({ message: 'Reserva confirmada', booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao confirmar reserva' });
  }
});

// PATCH /api/bookings/:id/complete
router.patch('/:id/complete', authenticate, authorize('professional', 'admin'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE bookings SET status = 'completed', completed_at = NOW()
      WHERE id = $1 AND status = 'confirmed'
      RETURNING *
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Reserva não encontrada' });

    // Atualizar pagamento
    await query(
      `UPDATE payments SET status = 'paid', paid_at = NOW() WHERE booking_id = $1`,
      [req.params.id]
    );

    res.json({ message: 'Sessão concluída', booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao concluir reserva' });
  }
});

// PATCH /api/bookings/:id/cancel
router.patch('/:id/cancel', authenticate, [
  body('reason').optional().isString(),
], async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, p.user_id as pro_user_id FROM bookings b JOIN professionals p ON p.id = b.professional_id WHERE b.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Reserva não encontrada' });
    const booking = result.rows[0];

    const isClient = booking.client_id === req.user.id;
    const isPro = booking.pro_user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isClient && !isPro && !isAdmin) return res.status(403).json({ error: 'Sem permissão' });
    if (!['pending','confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Esta reserva não pode ser cancelada' });
    }

    const cancelledBy = isClient ? 'cancelled_client' : 'cancelled_pro';
    const hoursUntil = (new Date(booking.scheduled_at) - new Date()) / 3600000;

    let refundPercent = 1;
    let refundMessage = 'Reembolso integral processado';
    if (hoursUntil < 2) { refundPercent = 0; refundMessage = 'Sem reembolso (cancelamento tardio)'; }
    else if (hoursUntil < 24) { refundPercent = 0.5; refundMessage = 'Reembolso de 50% processado'; }

    await query(`
      UPDATE bookings SET status = $1, cancellation_reason = $2, cancelled_at = NOW()
      WHERE id = $3
    `, [cancelledBy, req.body.reason || null, req.params.id]);

    if (refundPercent > 0) {
      await query(`UPDATE payments SET status = 'refunded', refunded_at = NOW(), refund_amount = $1 WHERE booking_id = $2`,
        [parseFloat((booking.total_amount * refundPercent).toFixed(2)), req.params.id]);
    }

    await auditLog(req.user.id, 'cancel_booking', 'booking', req.params.id, req);

    sendBookingCancellation(null, null, { bookingId: req.params.id }).catch(console.error);

    res.json({ message: `Reserva cancelada. ${refundMessage}.` });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Erro ao cancelar reserva' });
  }
});

module.exports = router;
