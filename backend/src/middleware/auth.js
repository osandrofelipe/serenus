const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Verifica JWT e injeta req.user
async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acesso ausente' });
    }

    const token = auth.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Token inválido' });
    }

    const result = await query(
      'SELECT id, name, surname, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Erro interno de autenticação' });
  }
}

// Verifica roles específicas
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

// Opcional: não retorna erro se não autenticado
async function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return next();
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, name, surname, email, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    if (result.rows.length) req.user = result.rows[0];
  } catch (_) {}
  next();
}

function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken };
}

module.exports = { authenticate, authorize, optionalAuth, generateTokens };
