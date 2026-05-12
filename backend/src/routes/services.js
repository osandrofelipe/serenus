const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Verificar limite de serviços por plano
const PLAN_LIMITS = { free: 1, basic: 5, pro: Infinity };

// POST /api/services
router.post('/', authenticate, authorize('professional'), [
  body('name').trim().notEmpty().isLength({ max: 150 }),
  body('duration_minutes').isInt({ min: 15, max: 480 }),
  body('price').isFloat({ min: 1 }),
  body('service_type').isIn(['local', 'home', 'both']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const proResult = await query(
      'SELECT id, plan FROM professionals WHERE user_id = $1 AND approval_status = $2',
      [req.user.id, 'approved']
    );
    if (!proResult.rows.length) return res.status(403).json({ error: 'Perfil ainda não aprovado' });

    const pro = proResult.rows[0];
    const limit = PLAN_LIMITS[pro.plan] || 1;

    const countResult = await query(
      'SELECT COUNT(*) FROM services WHERE professional_id = $1 AND is_active = true',
      [pro.id]
    );

    if (parseInt(countResult.rows[0].count) >= limit) {
      return res.status(403).json({
        error: `Seu plano ${pro.plan} permite até ${limit} serviço(s) ativo(s). Faça upgrade para adicionar mais.`
      });
    }

    const { name, description, duration_minutes, price, service_type } = req.body;
    const result = await query(`
      INSERT INTO services (professional_id, name, description, duration_minutes, price, service_type)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [pro.id, name, description || null, duration_minutes, price, service_type]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

// PUT /api/services/:id
router.put('/:id', authenticate, authorize('professional'), async (req, res) => {
  try {
    const proResult = await query('SELECT id FROM professionals WHERE user_id = $1', [req.user.id]);
    if (!proResult.rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });

    const { name, description, duration_minutes, price, service_type, is_active } = req.body;
    const result = await query(`
      UPDATE services SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        duration_minutes = COALESCE($3, duration_minutes),
        price = COALESCE($4, price),
        service_type = COALESCE($5, service_type),
        is_active = COALESCE($6, is_active)
      WHERE id = $7 AND professional_id = $8 RETURNING *
    `, [name, description, duration_minutes, price, service_type, is_active, req.params.id, proResult.rows[0].id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
});

// DELETE /api/services/:id (soft delete)
router.delete('/:id', authenticate, authorize('professional'), async (req, res) => {
  try {
    const proResult = await query('SELECT id FROM professionals WHERE user_id = $1', [req.user.id]);
    if (!proResult.rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });

    await query(
      'UPDATE services SET is_active = false WHERE id = $1 AND professional_id = $2',
      [req.params.id, proResult.rows[0].id]
    );
    res.json({ message: 'Serviço removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover serviço' });
  }
});

module.exports = router;
