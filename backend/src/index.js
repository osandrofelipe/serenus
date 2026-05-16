require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ===== SECURITY MIDDLEWARE =====
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL_2,
      'http://localhost:3000',
      'http://localhost:5173',
    ].filter(Boolean);
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    console.warn('CORS bloqueado para origem:', origin);
    callback(new Error('Origem nao permitida pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ===== RATE LIMITING =====
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ===== HEALTH CHECK =====
app.get('/health', async (req, res) => {
  try {
    const { query } = require('./db');
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ===== ROUTES =====
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/professionals', require('./routes/professionals'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/services', require('./routes/services'));
app.use('/api/admin', require('./routes/admin'));

// Notificações
const { authenticate } = require('./middleware/auth');
const { getUserNotifications, markAsRead } = require('./services/notifications');

app.get('/api/notifications', authenticate, async (req, res) => {
  const result = await getUserNotifications(req.user.id);
  res.json(result.rows);
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  await markAsRead(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada` });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message,
  });
});

// ===== START =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🌿 Serenus API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:   http://localhost:${PORT}/health\n`);
});

module.exports = app;