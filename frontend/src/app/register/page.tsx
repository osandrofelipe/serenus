'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authAPI } from '@/lib/api';
import Cookies from 'js-cookie';

const SPECIALTIES = ['Relaxamento','Terapêutica','Shiatsu','Hot Stone','Drenagem','Esportiva','Gestante','Ayurvédica','Reflexologia'];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'client'|'professional'>('client');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:'', surname:'', email:'', password:'', phone:'',
    cpf:'', city:'', state:'', experience_years:'', home_service: false,
    specialty:'Relaxamento', certifications:'', bio:'', base_price:''
  });

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Senha deve ter no mínimo 8 caracteres');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) return toast.error('Senha deve ter maiúsculas, minúsculas e números');

    setLoading(true);
    try {
      const payload: any = { name:form.name, surname:form.surname, email:form.email, password:form.password, phone:form.phone, role };
      const res = await authAPI.register(payload);
      const { accessToken, refreshToken } = res.data;
      Cookies.set('accessToken', accessToken, { expires: 7, secure: true, sameSite: 'strict' });
      Cookies.set('refreshToken', refreshToken, { expires: 30, secure: true, sameSite: 'strict' });

      if (role === 'professional') {
        toast.success('Conta criada! Complete seu perfil para ser aprovado.');
        router.push('/dashboard/profile');
      } else {
        toast.success('Conta criada com sucesso! Bem-vindo à Serenus 🌿');
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl font-light" style={{ color: 'var(--brown)' }}>
            Serenus<span style={{ color: 'var(--sage)' }}>.</span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: 'var(--brown2)' }}>Crie sua conta gratuita</p>
        </div>

        <div className="card p-8">
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(['client','professional'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`py-3 rounded-lg text-sm font-medium transition-all ${role===r ? 'btn-primary' : 'btn-outline'}`}>
                {r==='client' ? '👤 Sou cliente' : '🧑‍⚕️ Sou profissional'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Nome *</label>
                <input className="form-input" placeholder="Nome" value={form.name} onChange={e=>set('name',e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Sobrenome *</label>
                <input className="form-input" placeholder="Sobrenome" value={form.surname} onChange={e=>set('surname',e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>E-mail *</label>
              <input className="form-input" type="email" placeholder="seu@email.com" value={form.email} onChange={e=>set('email',e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Senha *</label>
                <input className="form-input" type="password" placeholder="Min. 8 caracteres" value={form.password} onChange={e=>set('password',e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Telefone</label>
                <input className="form-input" placeholder="(XX) XXXXX-XXXX" value={form.phone} onChange={e=>set('phone',e.target.value)} />
              </div>
            </div>

            {role === 'professional' && (
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--cream3)' }}>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--brown2)' }}>Dados profissionais</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>CPF *</label>
                    <input className="form-input" placeholder="000.000.000-00" value={form.cpf} onChange={e=>set('cpf',e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Anos de experiência</label>
                    <input className="form-input" type="number" min="0" placeholder="Ex: 5" value={form.experience_years} onChange={e=>set('experience_years',e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Cidade *</label>
                    <input className="form-input" placeholder="Ex: Natal" value={form.city} onChange={e=>set('city',e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Estado</label>
                    <input className="form-input" placeholder="Ex: RN" maxLength={2} value={form.state} onChange={e=>set('state',e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Especialidade principal</label>
                  <select className="form-input" value={form.specialty} onChange={e=>set('specialty',e.target.value)}>
                    {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Formação / Certificações</label>
                  <input className="form-input" placeholder="Ex: Graduação em Fisioterapia — UFC 2018" value={form.certifications} onChange={e=>set('certifications',e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="homeService" checked={form.home_service} onChange={e=>set('home_service',e.target.checked)} className="w-4 h-4 rounded" />
                  <label htmlFor="homeService" className="text-sm" style={{ color: 'var(--brown)' }}>Atendo a domicílio</label>
                </div>
                <p className="text-xs p-3 rounded-lg" style={{ background: 'var(--sage4)', color: 'var(--sage)' }}>
                  ⚠️ Seu perfil passará por análise em até 48h antes de ser publicado. Você receberá um e-mail com o resultado.
                </p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2 py-3 text-base mt-2">
              {loading ? '⏳ Criando conta...' : 'Criar minha conta'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t text-center text-sm" style={{ borderColor: 'var(--cream3)', color: 'var(--brown2)' }}>
            Já tem conta?{' '}
            <Link href="/login" className="font-medium" style={{ color: 'var(--sage)' }}>Entrar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
