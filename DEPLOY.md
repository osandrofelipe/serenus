# 🌿 Serenus — Guia Completo de Deploy e Configuração

> Sistema de contratação de massoterapeutas — Stack: Node.js + PostgreSQL + Next.js
> Deploy gratuito/baixo custo usando Railway (backend) + Supabase (banco) + Vercel (frontend)

---

## 📋 Visão geral da arquitetura de produção

```
[Usuário] → [Vercel - Frontend Next.js]
                    ↓ HTTPS
         [Railway - Backend Node.js/Express]
                    ↓
         [Supabase - PostgreSQL + Storage]
                    ↓
         [Resend - E-mails transacionais]
```

**Custo estimado inicial (planos gratuitos):**
- Supabase Free: banco de dados PostgreSQL, 500MB, 2 projetos grátis
- Railway Starter: $5 crédito grátis por mês (suficiente para MVP)
- Vercel Hobby: gratuito para projetos pessoais
- Resend Free: 3.000 e-mails/mês grátis

---

## PASSO 1 — Banco de Dados (Supabase)

### 1.1 Criar projeto

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em **New project**
3. Preencha:
   - **Name:** serenus
   - **Database Password: adr!@NMiguel210311 (guarde! você vai precisar)
   - **Region:** South America (São Paulo) — latência menor para o Brasil
4. Aguarde ~2 minutos para o projeto ser criado

### 1.2 Obter a connection string

1. No painel do projeto, vá em **Settings → Database**
2. Role até **Connection string → URI**
3. Copie a URI (vai parecer com):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
4. Guarde essa string — será usada como `DATABASE_URL`

### 1.3 Rodar as migrations

No seu computador local, com Node.js instalado:

```bash
cd backend
cp .env.example .env
# Edite o .env e cole a DATABASE_URL copiada acima

npm install
node src/db/migrate.js    # Cria todas as tabelas
node src/db/seed.js       # Insere dados iniciais + usuários demo
```

Saída esperada:
```
✅ Migrations concluídas com sucesso!
✅ Seed concluído!
🔑 Credenciais:
  Admin:         admin@serenus.com.br / Admin@2024!
  Cliente:       cliente@demo.com     / Cliente@123
  Profissional:  ana@demo.com         / Pro@12345
```

---

## PASSO 2 — Backend (Railway)

### 2.1 Criar conta e projeto

1. Acesse https://railway.app e crie conta (pode usar GitHub)
2. Clique em **New Project → Deploy from GitHub repo**
3. Conecte seu repositório GitHub (faça fork/push do código primeiro)
4. Selecione a pasta `backend` como root directory

### 2.2 Configurar variáveis de ambiente

No painel do Railway, vá em **Variables** e adicione:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:[SENHA]@db.[PROJETO].supabase.co:5432/postgres
JWT_SECRET=[GERE ABAIXO]
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
RESEND_API_KEY=re_[SEU_KEY]
EMAIL_FROM=noreply@serenus.com.br
EMAIL_FROM_NAME=Serenus
FRONTEND_URL=https://serenus.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10
```

**Como gerar o JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copie o resultado (128 caracteres hex) e use como JWT_SECRET.

### 2.3 Configurar o start command

No Railway, em **Settings → Deploy**:
- **Build Command:** `npm install`
- **Start Command:** `node src/index.js`
- **Root Directory:** `/backend`

### 2.4 Obter a URL do backend

Após o deploy, Railway gera uma URL como:
```
https://serenus-api-production.up.railway.app
```

Guarde essa URL — será usada no frontend como `NEXT_PUBLIC_API_URL`.

**Teste o backend:**
```bash
curl https://serenus-api-production.up.railway.app/health
# Resposta esperada: {"status":"ok","db":"connected"}
```

---

## PASSO 3 — E-mail (Resend)

### 3.1 Configurar

1. Acesse https://resend.com e crie conta gratuita
2. Vá em **API Keys → Create API Key**
3. Nome: `serenus-production`
4. Copie a chave (começa com `re_`)
5. Cole no Railway como `RESEND_API_KEY`

### 3.2 Verificar domínio (opcional mas recomendado)

Para e-mails chegarem na caixa de entrada (não spam):
1. No Resend, vá em **Domains → Add Domain**
2. Adicione seu domínio (ex: serenus.com.br)
3. Configure os registros DNS que o Resend indicar no seu provedor de domínio
4. Atualize `EMAIL_FROM` para `noreply@seudominio.com.br`

Sem domínio próprio, os e-mails serão enviados via `onboarding@resend.dev` (funciona para testes).

---

## PASSO 4 — Frontend (Vercel)

### 4.1 Deploy

1. Acesse https://vercel.com e crie conta (use GitHub)
2. Clique em **Add New → Project**
3. Importe seu repositório
4. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js (auto-detectado)

### 4.2 Variáveis de ambiente

Em **Settings → Environment Variables**:

```env
NEXT_PUBLIC_API_URL=https://serenus-api-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://serenus.vercel.app
```

### 4.3 Domínio personalizado (opcional)

1. Em **Settings → Domains**, adicione seu domínio
2. Configure o DNS no seu provedor apontando para a Vercel
3. SSL é provisionado automaticamente

---

## PASSO 5 — Testando o sistema completo

### 5.1 Fluxo de cliente

1. Acesse `https://serenus.vercel.app`
2. Clique em **Cadastrar** → Sou cliente
3. Crie uma conta com e-mail real
4. Vá em **Buscar** → selecione um profissional
5. Escolha serviço + data + horário → Reserve
6. Verifique o painel em **Dashboard**

### 5.2 Fluxo de profissional

1. Cadastre-se como profissional
2. Faça login como admin (`admin@serenus.com.br / Admin@2024!`)
3. Acesse **Painel → Aprovações** → Aprove o profissional
4. Faça login como profissional
5. Configure disponibilidade no painel

### 5.3 Fluxo de admin

Login: `admin@serenus.com.br / Admin@2024!`
- Dashboard com KPIs
- Aprovação de profissionais
- Gestão de reservas e usuários

---

## PASSO 6 — Configurações de produção adicionais

### 6.1 Atualize o CORS no backend

Em `backend/src/index.js`, adicione sua URL de produção:
```js
origin: [
  'https://serenus.vercel.app',
  'https://www.seudominio.com.br', // se tiver domínio próprio
],
```

### 6.2 Configurar Row Level Security no Supabase (opcional avançado)

No Supabase → SQL Editor, execute:
```sql
-- Exemplo: usuários só veem seus próprios dados
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_bookings" ON bookings
  USING (client_id = auth.uid() OR
         professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));
```

### 6.3 Backups automáticos

O Supabase faz backup automático diário no plano gratuito (últimos 7 dias).
Para backups manuais:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## 🔧 Desenvolvimento local

### Pré-requisitos
- Node.js 18+ instalado
- Docker (opcional, para banco local)

### Opção A — Com Docker (recomendado)
```bash
cd infra
docker compose up -d    # Sobe Postgres + Redis
cd ../backend
cp .env.example .env    # Configure DATABASE_URL para localhost
npm install
node src/db/migrate.js
node src/db/seed.js
npm run dev             # API na porta 3001

# Outro terminal:
cd ../frontend
cp .env.example .env.local
npm install
npm run dev             # Frontend na porta 3000
```

### Opção B — Sem Docker
Use o Supabase mesmo para desenvolvimento (é gratuito).
Configure o `.env` com a URL do Supabase e rode normalmente.

---

## 🔐 Checklist de segurança para produção

- [ ] JWT_SECRET com 64+ bytes aleatórios (não use o de exemplo)
- [ ] CORS configurado apenas para seu domínio
- [ ] Rate limiting ativo (já configurado no código)
- [ ] HTTPS obrigatório (Vercel e Railway já fornecem)
- [ ] Senha do banco com 20+ caracteres
- [ ] Variáveis de ambiente NUNCA commitadas no git
- [ ] `.gitignore` incluindo `.env` (já configurado)
- [ ] E-mail verificado antes de permitir agendamentos
- [ ] Logs de auditoria ativos (já implementado)

---

## 📊 Monitoramento (gratuito)

- **Logs do backend:** Railway → Deployments → View Logs
- **Erros do frontend:** Vercel → Functions → Logs
- **Banco de dados:** Supabase → Table Editor + SQL Editor
- **Uptime:** https://uptimerobot.com (free, monitora se API está online)

---

## 🚀 Próximos passos após MVP

1. **Pagamentos reais** — Pagar.me (suporte a PIX, boleto, cartão) ou Stripe
   - Pagar.me é mais fácil para Brasil (split nativo para marketplace)
   - Documentação: https://docs.pagar.me

2. **Notificações push** — Firebase Cloud Messaging (gratuito)
   - Adicionar `firebase-admin` no backend
   - Salvar FCM tokens dos usuários

3. **App mobile** — React Native com Expo
   - Reusa toda a lógica de `src/lib/api.ts`
   - Expo Go para testar sem precisar publicar

4. **Upload de documentos** — Supabase Storage (já disponível no projeto)
   - Adicionar rota `POST /api/professionals/me/documents`
   - Usar `multer` + SDK do Supabase para upload

5. **Chat entre cliente e profissional** — Socket.io + Redis
   - Adicionar `socket.io` no backend
   - Sala por booking_id, mensagens salvas no banco

---

## 📞 Suporte

Em caso de problemas:
- Verifique os logs no Railway (`railway logs`)
- Teste a rota `/health` do backend
- Confirme as variáveis de ambiente no Railway e Vercel
- Abra issue no repositório com o erro completo

---

*Serenus — Construído com Node.js, PostgreSQL, Next.js e muito ☕*
