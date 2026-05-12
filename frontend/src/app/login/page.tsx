'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.error('Preencha todos os campos');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Bem-vindo de volta!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl font-light" style={{ color: 'var(--brown)' }}>
            Serenus<span style={{ color: 'var(--sage)' }}>.</span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: 'var(--brown2)' }}>Entre na sua conta</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>E-mail</label>
              <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Senha</label>
              <div className="relative">
                <input className="form-input pr-10" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--brown3)' }}>
                  {showPass ? '👁' : '👁‍🗨'}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm" style={{ color: 'var(--sage)' }}>Esqueci a senha</Link>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2 py-3 text-base">
              {loading ? '⏳ Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t text-center text-sm" style={{ borderColor: 'var(--cream3)', color: 'var(--brown2)' }}>
            Não tem conta?{' '}
            <Link href="/register" className="font-medium" style={{ color: 'var(--sage)' }}>Cadastre-se grátis</Link>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--brown3)' }}>
          🔒 Conexão segura — seus dados são protegidos
        </p>
      </div>
    </div>
  );
}
