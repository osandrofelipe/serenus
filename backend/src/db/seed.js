require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./index');

async function seed() {
  console.log('🌱 Iniciando seed...');

  // Admin
  const adminHash = await bcrypt.hash('Admin@2024!', 12);
  await query(`
    INSERT INTO users (name, surname, email, phone, password_hash, role, email_verified)
    VALUES ('Admin', 'Serenus', 'admin@serenus.com.br', '(84) 99999-0000', $1, 'admin', true)
    ON CONFLICT (email) DO NOTHING
  `, [adminHash]);

  // Client demo
  const clientHash = await bcrypt.hash('Cliente@123', 12);
  const clientRes = await query(`
    INSERT INTO users (name, surname, email, phone, password_hash, role, email_verified)
    VALUES ('João', 'Silva', 'cliente@demo.com', '(84) 98888-1111', $1, 'client', true)
    ON CONFLICT (email) DO UPDATE SET password_hash = $1
    RETURNING id
  `, [clientHash]);
  const clientId = clientRes.rows[0]?.id;

  // Professionals
  const pros = [
    { name:'Ana', surname:'Carvalho', email:'ana@demo.com', phone:'(85) 97777-2222',
      cpf:'123.456.789-01', bio:'Especialista em massagem relaxante e drenagem linfática com 7 anos de experiência. Formada pela UFC com certificação internacional em técnicas orientais.',
      specialties:['Relaxamento','Drenagem'], city:'Fortaleza', state:'CE',
      experience_years:7, home_service:true, base_price:120,
      certs:['Graduação em Fisioterapia — UFC 2017','Certificação em Drenagem Linfática — ABRAFIM 2019'] },
    { name:'Carlos', surname:'Mendes', email:'carlos@demo.com', phone:'(84) 96666-3333',
      cpf:'234.567.890-12', bio:'Fisioterapeuta especializado em massoterapia esportiva e terapias de reabilitação. Atendo atletas amadores e profissionais há mais de uma década.',
      specialties:['Terapêutica','Esportiva'], city:'Natal', state:'RN',
      experience_years:10, home_service:false, base_price:140,
      certs:['Bacharelado em Fisioterapia — UFRN 2013','Especialização em Esportes — CREFITO 2016'] },
    { name:'Beatriz', surname:'Santos', email:'beatriz@demo.com', phone:'(81) 95555-4444',
      cpf:'345.678.901-23', bio:'Terapeuta holística com foco em técnicas orientais e uso de pedras quentes.',
      specialties:['Shiatsu','Hot Stone'], city:'Recife', state:'PE',
      experience_years:5, home_service:true, base_price:130,
      certs:['Curso Superior de Massoterapia — SENAC 2019','Certificação em Shiatsu — Instituto Oriental 2021'] },
  ];

  const proHash = await bcrypt.hash('Pro@12345', 12);

  for (const pro of pros) {
    const userRes = await query(`
      INSERT INTO users (name, surname, email, phone, password_hash, role, email_verified)
      VALUES ($1,$2,$3,$4,$5,'professional',true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $5
      RETURNING id
    `, [pro.name, pro.surname, pro.email, pro.phone, proHash]);

    const userId = userRes.rows[0]?.id;
    if (!userId) continue;

    // Verifica se já existe perfil profissional para este user
    const existingPro = await query('SELECT id FROM professionals WHERE user_id = $1', [userId]);
    let proRes;
    if (existingPro.rows.length) {
      proRes = await query(
        `UPDATE professionals SET cpf=$1, bio=$2, specialties=$3, certifications=$4,
         experience_years=$5, city=$6, state=$7, home_service=$8, base_price=$9,
         approval_status='approved', approved_at=NOW(), plan='basic', rating_avg=4.8, rating_count=12
         WHERE user_id=$10 RETURNING id`,
        [pro.cpf, pro.bio, pro.specialties, pro.certs, pro.experience_years,
         pro.city, pro.state, pro.home_service, pro.base_price, userId]
      );
    } else {
      proRes = await query(
        `INSERT INTO professionals (user_id, cpf, bio, specialties, certifications, experience_years, city, state, home_service, base_price, approval_status, approved_at, plan, rating_avg, rating_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved',NOW(),'basic',4.8,12) RETURNING id`,
        [userId, pro.cpf, pro.bio, pro.specialties, pro.certs, pro.experience_years,
         pro.city, pro.state, pro.home_service, pro.base_price]
      );
    }

    const proId = proRes.rows[0]?.id;
    if (!proId) continue;

    // Services - apaga os existentes e recria (idempotente)
    await query(`DELETE FROM services WHERE professional_id = $1`, [proId]);
    await query(`
      INSERT INTO services (professional_id, name, description, duration_minutes, price, service_type)
      VALUES
        ($1,'Massagem Relaxante','Técnica suave para alívio do estresse e tensão muscular',60,$2,'both'),
        ($1,'Massagem Terapêutica','Foco em pontos de tensão e dores específicas',60,$3,'local')
    `, [proId, pro.base_price, pro.base_price * 1.2]);

    // Availability (Seg-Sex 9h-18h)
    for (let day = 1; day <= 5; day++) {
      await query(`
        INSERT INTO availability (professional_id, weekday, start_time, end_time, break_between_minutes)
        VALUES ($1,$2,'09:00','18:00',30)
        ON CONFLICT (professional_id, weekday) DO NOTHING
      `, [proId, day]);
    }
  }

  console.log('✅ Seed concluído!');
  console.log('');
  console.log('🔑 Credenciais de acesso:');
  console.log('  Admin:      admin@serenus.com.br  / Admin@2024!');
  console.log('  Cliente:    cliente@demo.com       / Cliente@123');
  console.log('  Profissional: ana@demo.com         / Pro@12345');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed falhou:', err); process.exit(1); });