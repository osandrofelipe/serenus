const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/reviews
router.post('/', authenticate, authorize('client'), [
  body('booking_id').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 1000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { booking_id, rating, comment } = req.body;

  try {
    // Verificar que o booking pertence ao cliente e está completo
    const bookingResult = await query(
      `SELECT b.id, b.professional_id FROM bookings b
       WHERE b.id = $1 AND b.client_id = $2 AND b.status = 'completed'`,
      [booking_id, req.user.id]
    );

    if (!bookingResult.rows.length) {
      return res.status(400).json({ error: 'Reserva não encontrada ou sessão ainda não concluída' });
    }

    const booking = bookingResult.rows[0];

    // Verificar se já avaliou
    const existing = await query('SELECT id FROM reviews WHERE booking_id = $1', [booking_id]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Você já avaliou esta sessão' });
    }

    const result = await query(`
      INSERT INTO reviews (booking_id, client_id, professional_id, rating, comment)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [booking_id, req.user.id, booking.professional_id, rating, comment || null]);

    res.status(201).json({ message: 'Avaliação enviada! Obrigado.', review: result.rows[0] });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Erro ao enviar avaliação' });
  }
});

// PUT /api/reviews/:id/reply - Profissional responde avaliação
router.put('/:id/reply', authenticate, authorize('professional'), [
  body('reply').notEmpty().isLength({ max: 500 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const proResult = await query('SELECT id FROM professionals WHERE user_id = $1', [req.user.id]);
    if (!proResult.rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });

    const result = await query(`
      UPDATE reviews SET professional_reply = $1, professional_replied_at = NOW()
      WHERE id = $2 AND professional_id = $3 AND professional_reply IS NULL
      RETURNING id
    `, [req.body.reply, req.params.id, proResult.rows[0].id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Avaliação não encontrada' });
    res.json({ message: 'Resposta publicada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao responder avaliação' });
  }
});

// ADMIN: DELETE /api/reviews/:id (moderar)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await query(
      `UPDATE reviews SET is_public = false, moderated_at = NOW(), moderated_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Avaliação removida da exibição pública' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao moderar avaliação' });
  }
});

module.exports = router;
