// Serviço de e-mail usando Resend (resend.com - gratuito até 3000 emails/mês)
// Instalação: npm install resend

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV] Email para ${to}: ${subject}`);
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${process.env.EMAIL_FROM_NAME || 'Serenus'} <${process.env.EMAIL_FROM || 'noreply@serenus.com.br'}>`,
        to,
        subject,
        html,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Resend API error: ${err}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Email service error:', err.message);
    throw err;
  }
}

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:#3D2B1F;padding:28px 32px;text-align:center">
      <h1 style="color:#FFFFFF;margin:0;font-size:24px;font-weight:300;letter-spacing:-0.5px">Serenus<span style="color:#6B8F5E">.</span></h1>
      <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">Massoterapia sob demanda</p>
    </div>
    <div style="padding:32px">${content}</div>
    <div style="background:#FBF8F3;padding:20px 32px;border-top:1px solid #EAE3D6;text-align:center">
      <p style="color:#A0785A;font-size:12px;margin:0">© 2024 Serenus · <a href="mailto:suporte@serenus.com.br" style="color:#4A6741">suporte@serenus.com.br</a></p>
    </div>
  </div>
</body>
</html>
`;

async function sendVerificationEmail(email, name, token) {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Verifique seu e-mail — Serenus',
    html: baseTemplate(`
      <h2 style="color:#3D2B1F;font-size:22px;font-weight:400;margin:0 0 16px">Olá, ${name}! 👋</h2>
      <p style="color:#6B4C3B;line-height:1.6;margin:0 0 24px">Clique no botão abaixo para verificar seu e-mail e ativar sua conta na Serenus.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${url}" style="background:#3D2B1F;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:500;font-size:15px">Verificar e-mail</a>
      </div>
      <p style="color:#A0785A;font-size:12px">Link válido por 24 horas. Se não foi você, ignore este e-mail.</p>
    `),
  });
}

async function sendPasswordResetEmail(email, name, token) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Redefinição de senha — Serenus',
    html: baseTemplate(`
      <h2 style="color:#3D2B1F;font-size:22px;font-weight:400;margin:0 0 16px">Redefinir senha</h2>
      <p style="color:#6B4C3B;line-height:1.6;margin:0 0 24px">Olá, ${name}. Recebemos uma solicitação de redefinição de senha para sua conta.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${url}" style="background:#3D2B1F;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:500;font-size:15px">Redefinir senha</a>
      </div>
      <p style="color:#A0785A;font-size:12px">Link válido por 1 hora. Se não foi você, ignore este e-mail e sua senha permanece a mesma.</p>
    `),
  });
}

async function sendBookingConfirmation(email, clientName, { proName, serviceName, scheduledAt, totalAmount, bookingId }) {
  const dateStr = new Date(scheduledAt).toLocaleString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
  return sendEmail({
    to: email,
    subject: `Reserva confirmada: ${serviceName} com ${proName}`,
    html: baseTemplate(`
      <h2 style="color:#3D2B1F;font-size:22px;font-weight:400;margin:0 0 16px">Reserva confirmada! ✅</h2>
      <p style="color:#6B4C3B;line-height:1.6;margin:0 0 24px">Olá, ${clientName}! Sua sessão foi agendada com sucesso.</p>
      <div style="background:#EAF0E8;border-radius:12px;padding:20px;margin:0 0 24px">
        <div style="margin-bottom:8px"><strong style="color:#3D2B1F">${serviceName}</strong> com <strong>${proName}</strong></div>
        <div style="color:#6B4C3B;font-size:14px">📅 ${dateStr}</div>
        <div style="color:#6B4C3B;font-size:14px;margin-top:4px">💰 R$ ${parseFloat(totalAmount).toFixed(2)}</div>
        <div style="color:#A0785A;font-size:12px;margin-top:4px">#${bookingId.substring(0,8).toUpperCase()}</div>
      </div>
      <p style="color:#6B4C3B;font-size:13px;line-height:1.6">
        ⚠️ <strong>Cancelamento:</strong> Gratuito com mais de 24h de antecedência.<br>
        Entre 2–24h: reembolso de 50%. Menos de 2h: sem reembolso.
      </p>
    `),
  });
}

async function sendBookingCancellation(email, name, { bookingId }) {
  if (!email) return;
  return sendEmail({
    to: email,
    subject: 'Reserva cancelada — Serenus',
    html: baseTemplate(`
      <h2 style="color:#3D2B1F;font-size:22px;font-weight:400;margin:0 0 16px">Reserva cancelada</h2>
      <p style="color:#6B4C3B;line-height:1.6">Sua reserva #${(bookingId||'').substring(0,8).toUpperCase()} foi cancelada. O reembolso será processado conforme a política de cancelamento.</p>
    `),
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmation,
  sendBookingCancellation,
};
