const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { generateTokens, authenticate } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { auditLog } = require('../utils/audit');

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Nome obrigatório').isLength({ max: 100 }),
  body('surname').trim().notEmpty().withMessage('Sobrenome obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Senha deve conter maiúsculas, minúsculas e números'),
  body('role').isIn(['client', 'professional']).withMessage('Role inválida'),
];

// POST /api/auth/register
router.post('/register', validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, surname, email, password, role, phone } = req.body;

  try {
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = uuidv4();

    const result = await query(`
      INSERT INTO users (name, surname, email, phone, password_hash, role, email_verify_token)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, surname, email, role
    `, [name, surname, email, phone || null, passwordHash, role, verifyToken]);

    const user = result.rows[0];

    // Se profissional, criar perfil pendente
    if (role === 'professional') {
      await query(
        'INSERT INTO professionals (user_id) VALUES ($1)',
        [user.id]
      );
    }

    // Enviar e-mail de verificação (não bloqueia se falhar)
    sendVerificationEmail(email, name, verifyToken).catch(e =>
      console.error('Email send error:', e.message)
    );

    await auditLog(user.id, 'register', 'user', user.id, req);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Salva hash do refresh token
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [refreshHash, user.id]);

    res.status(201).json({
      message: 'Conta criada com sucesso! Verifique seu e-mail.',
      user: { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Dados inválidos' });

  const { email, password } = req.body;

  try {
    const result = await query(`
      SELECT u.*, p.id as pro_id, p.approval_status
      FROM users u
      LEFT JOIN professionals p ON p.user_id = u.id
      WHERE u.email = $1
    `, [email]);

    if (!result.rows.length) {
      await new Promise(r => setTimeout(r, 500)); // timing-safe
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta suspensa. Entre em contato com o suporte.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await auditLog(user.id, 'login_failed', 'user', user.id, req);
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    const refreshHash = await bcrypt.hash(refreshToken, 10);

    await query(
      'UPDATE users SET refresh_token_hash = $1, last_login = NOW() WHERE id = $2',
      [refreshHash, user.id]
    );

    await auditLog(user.id, 'login', 'user', user.id, req);

    const responseUser = {
      id: user.id, name: user.name, surname: user.surname,
      email: user.email, role: user.role, avatar_url: user.avatar_url,
      email_verified: user.email_verified,
    };

    if (user.role === 'professional') {
      responseUser.pro_id = user.pro_id;
      responseUser.approval_status = user.approval_status;
    }

    res.json({ user: responseUser, accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token ausente' });

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Token inválido' });

    const result = await query(
      'SELECT id, role, refresh_token_hash, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(refreshToken, user.refresh_token_hash || '');
    if (!valid) return res.status(401).json({ error: 'Refresh token inválido ou já utilizado' });

    const tokens = generateTokens(user.id, user.role);
    const newRefreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [newRefreshHash, user.id]);

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Token expirado ou inválido' });
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await query(
      'UPDATE users SET email_verified = true, email_verify_token = NULL WHERE email_verify_token = $1 RETURNING id',
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Token inválido ou já utilizado' });
    res.json({ message: 'E-mail verificado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar e-mail' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req, res) => {
  const { email } = req.body;
  try {
    const result = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    // Sempre retorna 200 (não revela se email existe)
    if (result.rows.length) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 3600000); // 1h
      await query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3',
        [token, expires, email]
      );
      sendPasswordResetEmail(email, result.rows[0].name, token).catch(console.error);
    }
    res.json({ message: 'Se o e-mail existir, você receberá um link de redefinição.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { token, password } = req.body;
  try {
    const result = await query(
      `SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Token inválido ou expirado' });

    const hash = await bcrypt.hash(password, 12);
    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [hash, result.rows[0].id]
    );
    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.role, u.avatar_url, u.email_verified, u.created_at,
             p.id as pro_id, p.approval_status, p.rating_avg, p.rating_count, p.plan, p.city, p.specialties
      FROM users u
      LEFT JOIN professionals p ON p.user_id = u.id
      WHERE u.id = $1
    `, [req.user.id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await query('UPDATE users SET refresh_token_hash = NULL WHERE id = $1', [req.user.id]);
  await auditLog(req.user.id, 'logout', 'user', req.user.id, req);
  res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = router;
