const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('query', { text: text.substring(0, 80), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Query error:', { text: text.substring(0, 80), error: error.message });
    throw error;
  }
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
