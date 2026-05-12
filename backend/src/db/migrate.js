require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('🚀 Iniciando migrations...');

  // Enable UUID extension
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);

  // ---- USERS ----
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) NOT NULL,
      surname VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'professional', 'admin')),
      avatar_url TEXT,
      email_verified BOOLEAN DEFAULT FALSE,
      email_verify_token VARCHAR(255),
      password_reset_token VARCHAR(255),
      password_reset_expires TIMESTAMPTZ,
      refresh_token_hash VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- PROFESSIONALS ----
  await query(`
    CREATE TABLE IF NOT EXISTS professionals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cpf VARCHAR(14) UNIQUE,
      bio TEXT,
      specialties TEXT[] DEFAULT '{}',
      certifications TEXT[] DEFAULT '{}',
      experience_years INTEGER DEFAULT 0,
      city VARCHAR(100),
      state VARCHAR(2),
      address TEXT,
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      home_service BOOLEAN DEFAULT FALSE,
      base_price DECIMAL(10,2),
      approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','suspended')),
      rejection_reason TEXT,
      approved_at TIMESTAMPTZ,
      approved_by UUID REFERENCES users(id),
      plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free','basic','pro')),
      plan_expires_at TIMESTAMPTZ,
      rating_avg DECIMAL(3,2) DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      is_featured BOOLEAN DEFAULT FALSE,
      document_urls TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- SERVICES ----
  await query(`
    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      price DECIMAL(10,2) NOT NULL,
      service_type VARCHAR(20) DEFAULT 'both' CHECK (service_type IN ('local','home','both')),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- AVAILABILITY ----
  await query(`
    CREATE TABLE IF NOT EXISTS availability (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      break_between_minutes INTEGER DEFAULT 15,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(professional_id, weekday)
    )
  `);

  // ---- AVAILABILITY BLOCKS (feriados, folgas) ----
  await query(`
    CREATE TABLE IF NOT EXISTS availability_blocks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      blocked_date DATE NOT NULL,
      reason VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- BOOKINGS ----
  await query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id UUID NOT NULL REFERENCES users(id),
      professional_id UUID NOT NULL REFERENCES professionals(id),
      service_id UUID NOT NULL REFERENCES services(id),
      scheduled_at TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled_client','cancelled_pro','disputed')),
      service_address TEXT,
      service_type VARCHAR(20),
      total_amount DECIMAL(10,2) NOT NULL,
      platform_fee DECIMAL(10,2) NOT NULL,
      professional_net DECIMAL(10,2) NOT NULL,
      client_notes TEXT,
      cancellation_reason TEXT,
      cancelled_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      payment_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- PAYMENTS ----
  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      booking_id UUID NOT NULL REFERENCES bookings(id),
      gateway VARCHAR(50) NOT NULL DEFAULT 'stripe',
      gateway_payment_id VARCHAR(255),
      gateway_charge_id VARCHAR(255),
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'BRL',
      platform_fee DECIMAL(10,2),
      professional_net DECIMAL(10,2),
      status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','refunded','partially_refunded','disputed')),
      payment_method VARCHAR(50),
      paid_at TIMESTAMPTZ,
      refunded_at TIMESTAMPTZ,
      refund_amount DECIMAL(10,2),
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- REVIEWS ----
  await query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
      client_id UUID NOT NULL REFERENCES users(id),
      professional_id UUID NOT NULL REFERENCES professionals(id),
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      is_public BOOLEAN DEFAULT TRUE,
      professional_reply TEXT,
      professional_replied_at TIMESTAMPTZ,
      moderated_at TIMESTAMPTZ,
      moderated_by UUID REFERENCES users(id),
      is_flagged BOOLEAN DEFAULT FALSE,
      flag_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- NOTIFICATIONS ----
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      data JSONB,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- AUDIT LOG ----
  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id UUID,
      ip_address INET,
      user_agent TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ---- INDEXES ----
  await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_professionals_user ON professionals(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_professionals_status ON professionals(approval_status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_professionals_city ON professionals(city)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_professionals_specs ON professionals USING GIN(specialties)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_services_professional ON services(professional_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bookings_professional ON bookings(professional_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON bookings(scheduled_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_reviews_professional ON reviews(professional_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)`);

  // ---- UPDATED_AT TRIGGER ----
  await query(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql
  `);

  for (const table of ['users','professionals','services','bookings','payments','reviews']) {
    await query(`
      DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};
      CREATE TRIGGER trg_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
  }

  // ---- RATING RECALC TRIGGER ----
  await query(`
    CREATE OR REPLACE FUNCTION recalc_professional_rating()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE professionals SET
        rating_avg = (SELECT COALESCE(AVG(rating::numeric),0) FROM reviews WHERE professional_id = NEW.professional_id AND is_public = TRUE),
        rating_count = (SELECT COUNT(*) FROM reviews WHERE professional_id = NEW.professional_id AND is_public = TRUE)
      WHERE id = NEW.professional_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await query(`
    DROP TRIGGER IF EXISTS trg_rating_recalc ON reviews;
    CREATE TRIGGER trg_rating_recalc
      AFTER INSERT OR UPDATE OR DELETE ON reviews
      FOR EACH ROW EXECUTE FUNCTION recalc_professional_rating()
  `);

  console.log('✅ Migrations concluídas com sucesso!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Erro na migration:', err);
  process.exit(1);
});
